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

// starts capturing user's screen
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

// creates popup overlay (PIP) for camera stream
const showCameraStreamPopup = ({ videoSrc, document, cameraStreamVideoEl }: showCameraStreamPopupParams) => {
  // video container to show live video stream from camera

  cameraStreamVideoEl = document.createElement('video');
  cameraStreamVideoEl.style.display = 'hidden';
  cameraStreamVideoEl.srcObject = videoSrc;
  cameraStreamVideoEl.muted = true;
  cameraStreamVideoEl.playsInline = true;
  cameraStreamVideoEl.onloadedmetadata = async () => {
    await cameraStreamVideoEl.play();
    document.body.appendChild(cameraStreamVideoEl);
    if (document.pictureInPictureEnabled) {
      await cameraStreamVideoEl.requestPictureInPicture();
    } else {
      throw new Error('Error: PIP mode disabled');
    }
  };
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
      audio: true,
      video: {
        //@ts-ignore
        mediaSource: 'screen',
      },
      //@ts-ignore
      surfaceSwitching: 'include',
      //@ts-ignore
      selfBrowserSurface: 'exclude',
    });

    // getting screen capture streams
    cameraStream = await startCameraCapture(cameraStream, {
      audio: true,
      video: true,
    });

    screenShareVideoEl.srcObject = new MediaStream(screenStream.getTracks());
    screenShareVideoEl.muted = true;
    screenShareVideoEl.playsInline = true;
    screenShareVideoEl.onloadedmetadata = async () => {
      await screenShareVideoEl.play();
    };

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

    // creating media recorder for screen stream
    mediaRecorder = new MediaRecorder(screenStream, {
      mimeType: 'video/webm',
    });

    mediaRecorder.ondataavailable = (ev) => {
      console.log(
        '🚀 ~ file: background.ts:159 ~ startRecordingModalContainer.addEventListener ~ on-data-available:',
        ev.data
      );

      videoChunks.push(ev.data);
    };

    mediaRecorder.onstop = async (ev) => {
      console.log('media-recorder event', ev);
      console.log('Video chunks', videoChunks);

      const videoString = await blobToBase64(new Blob(videoChunks, { type: videoChunks[0].type }));

      try {
        await chrome.storage.local.remove('video');
        await chrome.storage.local.set({
          video: videoString,
        });
        console.log('Video data set to local storage');
      } catch (error) {
        console.log(error);
      }
      const frontendURL = 'http://localhost:3000/draft';

      window.open(frontendURL, '_blank');
    };
    mediaRecorder.start();
  }
};

const showStartRecordingOptions = ({
  document,
  startRecordingModalContainer,
  overlayBackdrop,
}: ShowStartRecordingOptionsParams) => {
  //overlayBackdrop styles
  overlayBackdrop.style.width = '100vw';
  overlayBackdrop.style.height = '100vh';
  overlayBackdrop.style.backgroundColor = '#272A35';
  overlayBackdrop.style.opacity = '.4';
  overlayBackdrop.style.position = 'fixed';
  overlayBackdrop.style.top = '0';
  overlayBackdrop.style.left = '0';
  1;

  document.body.style.width = '100vw';
  document.body.style.position = 'fixed';

  document.body.appendChild(overlayBackdrop);

  // control menu
  startRecordingModalContainer.style.width = '300px';
  startRecordingModalContainer.style.height = '65px';
  startRecordingModalContainer.style.backgroundColor = '#1B72E8';
  startRecordingModalContainer.style.position = 'absolute';
  startRecordingModalContainer.style.marginLeft = 'auto';
  startRecordingModalContainer.style.marginRight = 'auto';
  startRecordingModalContainer.style.bottom = '5%';
  startRecordingModalContainer.style.left = '0';
  startRecordingModalContainer.style.right = '0';
  startRecordingModalContainer.style.borderRadius = '4px';
  startRecordingModalContainer.textContent = 'Record';

  // append controls on the overlayBackdrop
  overlayBackdrop.appendChild(startRecordingModalContainer);
};

const openRecorder = () => {
  let startRecordingModalContainer: HTMLDivElement = document.createElement('div');
  let overlayBackdrop: HTMLDivElement = document.createElement('div');
  let screenShareVideoEl: HTMLVideoElement = document.createElement('video');
  let cameraStreamVideoEl: HTMLVideoElement;
  let screenStream: MediaStream;
  let cameraStream: MediaStream;
  let videoChunks: Blob[] = [];
  let mediaRecorder: MediaRecorder;

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
