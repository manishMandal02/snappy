declare const videoStreamMerger: any;

//types
type OnRecordingStartParams = {
  document: Document;
  mediaRecorder: MediaRecorder;
  overlayBackdrop: HTMLDivElement;
  screenStream: MediaStream;
  cameraStream: MediaStream;

  screenShareVideoEl: HTMLVideoElement;
  cameraStreamVideoEl: HTMLVideoElement;
  videoChunks: Blob[];
  startRecordingModalContainer: HTMLDivElement;
};
type ShowStartRecordingOptionsParams = {
  document: Document;
  overlayBackdrop: HTMLDivElement;
  startRecordingModalContainer: HTMLDivElement;
};
type showCameraStreamPopupParams = {
  document: Document;
  videoSrc: MediaStream;
  cameraStreamVideoEl: HTMLVideoElement;
};

type OnStopRecordingParams = {
  document: Document;
  mediaRecorder: MediaRecorder;
  screenShareVideoEl: HTMLVideoElement | null;
  cameraStreamVideoEl: HTMLVideoElement | null;
  screenStream: MediaStream;
  cameraStream: MediaStream;
  videoChunks: Blob[];
};
const openRecorder = () => {
  let startRecordingModalContainer: HTMLDivElement = document.createElement('div');
  let overlayBackdrop: HTMLDivElement = document.createElement('div');
  let screenShareVideoEl: HTMLVideoElement = document.createElement('video');
  let cameraStreamVideoEl: HTMLVideoElement = document.createElement('video');
  let screenStream: MediaStream;
  let cameraStream: MediaStream;
  let cameraAudioStream: MediaStream;
  let audioContext = new AudioContext();
  let audioDestination = audioContext.createMediaStreamDestination();
  let audioTracks: MediaStreamAudioSourceNode[] = [];
  let videoChunks: Blob[] = [];
  let videoHeight: number;
  let videoWidth: number;
  let mediaRecorder: MediaRecorder;

  //camera popup overlay position
  let currX: number = 0,
    currY: number = 0,
    prevX: number = 0,
    prevY: number = 0;

  // get highest z-index set on the any element to set our el as the top most el
  const getMaxZIndex = () => {
    return Math.max(
      ...Array.from(document.querySelectorAll('body *'), (el) =>
        parseFloat(window.getComputedStyle(el).zIndex)
      ).filter((zIndex) => !Number.isNaN(zIndex)),
      0
    );
  };

  // makes the camera popup over as draggable
  const dragCameraPopupOverlay = () => {
    const dragElement = () => {
      cameraStreamVideoEl.onmousedown = dragMouseDown;
    };

    const dragMouseDown = (e: MouseEvent) => {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      currX = e.clientX;
      currY = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    };

    function elementDrag(e: MouseEvent) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      prevX = currX - e.clientX;
      prevY = currY - e.clientY;
      currX = e.clientX;
      currY = e.clientY;

      const maxBoundaryToRight = Number(
        document.documentElement.clientWidth - cameraStreamVideoEl.offsetWidth
      );
      const maxBoundaryToBottom = Number(
        document.documentElement.clientHeight - cameraStreamVideoEl.offsetHeight
      );

      // set the element's new position:
      // set pos relative to y axis and not overflow it
      if (cameraStreamVideoEl.offsetTop > 0) {
        if (cameraStreamVideoEl.offsetTop > maxBoundaryToBottom) {
          cameraStreamVideoEl.style.top = Number(maxBoundaryToBottom - 10) + 'px';
        } else {
          cameraStreamVideoEl.style.top = cameraStreamVideoEl.offsetTop - prevY + 'px';
        }
      } else {
        cameraStreamVideoEl.style.top = 10 + 'px';
      }

      // set pos relative to x axis  and not overflow it
      if (cameraStreamVideoEl.offsetLeft > 0) {
        if (cameraStreamVideoEl.offsetLeft > maxBoundaryToRight) {
          cameraStreamVideoEl.style.left = Number(maxBoundaryToRight - 10) + 'px';
        } else {
          cameraStreamVideoEl.style.left = cameraStreamVideoEl.offsetLeft - prevX + 'px';
        }
      } else {
        cameraStreamVideoEl.style.left = 10 + 'px';
      }
    }

    function closeDragElement() {
      /* stop moving when mouse button is released:*/
      document.onmouseup = null;
      document.onmousemove = null;
    }
    //initialize the drag fn
    dragElement();
  };

  // converts blob to base64 string
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (_e) => resolve(reader.result as string);
      reader.onerror = (_e) => reject(reader.error);
      reader.onabort = (_e) => reject(new Error('Read aborted'));
      reader.readAsDataURL(blob);
    });
  };

  // // starts capturing user's screen
  const startScreenCapture = async (
    screenStream: MediaStream,
    displayMediaOptions: DisplayMediaStreamOptions
  ) => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err) {
      console.error(`Error: capturing screen ${err}`);
    }
    return screenStream;
  };

  // starts capturing user's camera
  const startCameraCapture = async (cameraStream: MediaStream, constraints?: MediaStreamConstraints) => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error(`Error: capturing camera ${err}`);
    }
    return cameraStream;
  };

  const showCameraStreamPopup = ({
    videoSrc,
    document,
    cameraStreamVideoEl,
  }: showCameraStreamPopupParams) => {
    cameraStreamVideoEl.srcObject = videoSrc;
    cameraStreamVideoEl.style.position = 'fixed';
    cameraStreamVideoEl.style.height = '200px';
    cameraStreamVideoEl.style.width = '200px';
    cameraStreamVideoEl.style.bottom = '10%';
    cameraStreamVideoEl.style.left = '10%';
    cameraStreamVideoEl.style.cursor = 'move';
    cameraStreamVideoEl.draggable = true;
    cameraStreamVideoEl.style.objectFit = 'cover';
    cameraStreamVideoEl.style.zIndex = Number(getMaxZIndex() + 10).toString();

    console.log('max zIndex', getMaxZIndex().toString());

    cameraStreamVideoEl.style.borderRadius = '50%';

    cameraStreamVideoEl.muted = true;

    cameraStreamVideoEl.playsInline = true;
    document.body.appendChild(cameraStreamVideoEl);
    cameraStreamVideoEl.onloadedmetadata = async () => {
      await cameraStreamVideoEl.play();
      // drawToCanvas();
    };
  };

  const showStartRecordingOptions = ({
    document,
    startRecordingModalContainer,
    overlayBackdrop,
  }: ShowStartRecordingOptionsParams) => {
    //overlayBackdrop styles
    overlayBackdrop.style.width = '100vw';
    overlayBackdrop.style.height = '100vh';
    overlayBackdrop.style.backgroundColor = '#272a3585';
    overlayBackdrop.style.position = 'fixed';
    overlayBackdrop.style.top = '0';
    overlayBackdrop.style.left = '0';
    overlayBackdrop.style.zIndex = Number(getMaxZIndex() + 10).toString();

    document.body.style.width = '100vw';
    document.body.style.position = 'fixed';

    document.body.appendChild(overlayBackdrop);

    // control menu
    startRecordingModalContainer.style.width = '300px';
    startRecordingModalContainer.style.height = '65px';
    startRecordingModalContainer.style.backgroundColor = '#2dd4bf';
    startRecordingModalContainer.style.position = 'absolute';
    startRecordingModalContainer.style.marginLeft = 'auto';
    startRecordingModalContainer.style.marginRight = 'auto';
    startRecordingModalContainer.style.bottom = '5%';
    startRecordingModalContainer.style.left = '0';
    startRecordingModalContainer.style.right = '0';
    startRecordingModalContainer.style.zIndex = Number(getMaxZIndex() + 20).toString();
    startRecordingModalContainer.style.borderRadius = '12px';
    startRecordingModalContainer.style.display = 'flex';
    startRecordingModalContainer.style.alignItems = 'center';
    startRecordingModalContainer.style.justifyContent = 'center';
    startRecordingModalContainer.style.color = '#ffff';
    startRecordingModalContainer.style.fontSize = '42px';
    startRecordingModalContainer.style.fontWeight = '600';
    startRecordingModalContainer.style.cursor = 'pointer';
    startRecordingModalContainer.textContent = 'Record';

    // append controls on the overlayBackdrop
    overlayBackdrop.appendChild(startRecordingModalContainer);
  };

  const onStopRecording = async ({
    document,
    cameraStream,
    cameraStreamVideoEl,
    mediaRecorder,
    screenShareVideoEl,
    screenStream,
    videoChunks,
  }: OnStopRecordingParams) => {
    [...screenStream.getTracks(), ...cameraStream.getTracks()].map((t) => t.stop());

    screenShareVideoEl?.remove();
    cameraStreamVideoEl?.remove();

    const videoString = await blobToBase64(new Blob(videoChunks));

    try {
      await chrome.storage.local.remove('video');
      await chrome.storage.local.set({
        video: videoString,
      });
      console.log('Video data set to local storage');
    } catch (error) {
      console.log(error);
    }
    const frontendURL = 'http://localhost:3000';

    window.open(frontendURL + '/draft', '_blank');
  };

  const onRecordingStart = async ({
    document,
    cameraStream,
    mediaRecorder,
    overlayBackdrop,
    screenStream,
    screenShareVideoEl,
    startRecordingModalContainer,
    videoChunks,
    cameraStreamVideoEl,
  }: OnRecordingStartParams) => {
    {
      // remove overlay and options/settings containers and all constraints
      document.body.style.width = '100vw';
      document.body.style.position = 'relative';
      overlayBackdrop.removeChild(startRecordingModalContainer);
      document.body.removeChild(overlayBackdrop);

      // get access to user's camera and microphone
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (err) {
        alert('You need to grant us permission to use camera and microphone to record.');
        throw new Error('Access denied by user for Camera and microphone.');
      }

      // getting screen capture streams
      screenStream = await startScreenCapture(screenStream, {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: {
          //@ts-ignore
          mediaSource: 'screen',
          width: 1280,
          height: 720,
        },
      });

      // getting screen capture streams
      cameraStream = await startCameraCapture(cameraStream, {
        audio: false,
        video: true,
      });

      // getting screen capture streams
      cameraAudioStream = await startCameraCapture(cameraStream, {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });

      const mergedAudioStreams = [...cameraAudioStream.getAudioTracks(), ...screenStream.getAudioTracks()];

      audioTracks.push(audioContext.createMediaStreamSource(new MediaStream([...mergedAudioStreams])));
      audioTracks.forEach((track) => track.connect(audioDestination));
      if (!screenStream) {
        throw new Error('Not able to capture screen.');
      }

      if (!cameraStream) {
        throw new Error('Not able to capture camera & microphone.');
      }

      showCameraStreamPopup({
        videoSrc: new MediaStream(cameraStream.getTracks()),
        cameraStreamVideoEl,
        document,
      });

      // make the camera popup draggable
      dragCameraPopupOverlay();

      const mergedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioDestination.stream.getTracks(),
      ]);

      const screenMediaRecorder = new MediaRecorder(screenStream);

      // creating media recorder for screen stream
      mediaRecorder = new MediaRecorder(new MediaStream(mergedStream), {
        mimeType: 'video/webm; codecs=vp9',
      });

      mediaRecorder.ondataavailable = (ev) => {
        // console.log(
        //   '🚀 ~ file: background.ts:159 ~ startRecordingModalContainer.addEventListener ~ on-data-available:',
        //   ev.data
        // );

        videoChunks.push(ev.data);
      };

      screenMediaRecorder.onstop = async () => {
        mediaRecorder.stop();
        await onStopRecording({
          cameraStream,
          document,
          cameraStreamVideoEl,
          mediaRecorder,
          screenShareVideoEl,
          screenStream,
          videoChunks,
        });
      };
      mediaRecorder.start(500);
      screenMediaRecorder.start();
    }
  };

  // show's recoding options modal with start recording button
  showStartRecordingOptions({ document, overlayBackdrop, startRecordingModalContainer });

  // start's screen & camera recording - triggered as user clicks start recording
  startRecordingModalContainer.addEventListener('click', async () => {
    onRecordingStart({
      document,
      cameraStream,
      mediaRecorder,
      overlayBackdrop,
      screenShareVideoEl,
      screenStream,
      startRecordingModalContainer,
      videoChunks,
      cameraStreamVideoEl,
    });
  });
};

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Clicked extension -recorder');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: openRecorder,
  });
});
