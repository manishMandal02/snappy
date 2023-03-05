const openRecorder = () => {
  let box: HTMLDivElement;
  let overlay: HTMLDivElement;
  let screenShareVideoEl: HTMLVideoElement;
  let screenStream: MediaStream;
  let cameraStream: MediaStream | null;
  let streamMaxWidth: number;
  const canvasEl = document.createElement('canvas');
  const canvasCtx = canvasEl.getContext('2d')!;

  let streamMaxHeight: number;
  let mergedStream: MediaStream;
  let videoTracks: MediaStreamTrack[];
  let videoChunks: Blob[] = [];
  let mediaRecorder: MediaRecorder;
  let DEFAULT_FPS = 30;

  let cameraStreamVideoEl: HTMLVideoElement;

  // On click extension icon

  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (_e) => resolve(reader.result as string);
      reader.onerror = (_e) => reject(reader.error);
      reader.onabort = (_e) => reject(new Error('Read aborted'));
      reader.readAsDataURL(blob);
    });
  };

  const requestVideoFrame = function (callback: (date?: any) => void) {
    return window.setTimeout(function () {
      callback(Date.now());
    }, 1000 / 60); // 60 fps - just like requestAnimationFrame
  };

  // const videoStreamMergerScript = document.createElement('script');
  // videoStreamMergerScript.src = 'videoStreamMerger.js';
  // videoStreamMergerScript.type = 'text/javascript';
  // document.head.appendChild(videoStreamMergerScript);

  /**
   * Internal polyfill to simulate
   * window.cancelAnimationFrame
   */
  const cancelVideoFrame = function (id: string) {
    clearTimeout(id);
  };

  const startScreenCapture = async (displayMediaOptions: DisplayMediaStreamOptions) => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err) {
      console.error(`Error: ${err}`);
    }
    return screenStream;
  };

  const startCameraCapture = async (constraints?: MediaStreamConstraints) => {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error(`Error: ${err}`);
    }
    return cameraStream;
  };

  // combining screen and camera video stream to one with canvas

  const drawingLoop = () => {
    canvasCtx.drawImage(screenShareVideoEl, 0, 0, streamMaxWidth, streamMaxHeight);
    canvasCtx.drawImage(
      cameraStreamVideoEl,
      0,
      Math.floor(streamMaxWidth - streamMaxHeight / 4),
      Math.floor(streamMaxWidth / 4),
      Math.floor(streamMaxHeight / 4)
    ); // this is just a rough calculation to offset the webcam stream to bottom left
    //
    // let imageData = canvasCtx.getImageData(0, 0, streamMaxWidth || 1280, streamMaxHeight || 720); // this makes it work
    // canvasCtx.putImageData(imageData, 0, 0); // properly on safari/webkit browsers too
    // canvasCtx.restore();
    requestVideoFrame(combineStreamToCanvas);
  };

  const combineStreamToCanvas = () => {
    if (!screenShareVideoEl || !cameraStreamVideoEl) {
      throw new Error('Error: Camera or screen feed not available');
    }

    streamMaxHeight = screenShareVideoEl.videoHeight;
    streamMaxWidth = screenShareVideoEl.videoWidth;

    canvasEl.setAttribute('width', `${streamMaxWidth}px`);
    canvasEl.setAttribute('height', `${streamMaxHeight}px`);
    // canvasCtx.clearRect(0, 0, streamMaxWidth, streamMaxHeight);

    drawingLoop();
  };

  // capture frames from each video stream and draw them onto the canvas
  // function drawFrame() {
  //   canvasCtx.save();
  //   canvasEl.setAttribute('width', `${streamMaxWidth}px`);
  //   canvasEl.setAttribute('height', `${streamMaxHeight}px`);
  //   canvasCtx.drawImage(screenShareVIdeoEl, 0, 0, streamMaxWidth, streamMaxHeight);
  //   canvasCtx.drawImage(cameraStreamVideoEl, 10, 10, 8, 8);

  //   // convert the canvas to a blob and create a new video track
  //   canvasEl.toBlob((blob) => {
  //     const newTrack = new MediaStreamTrack();

  //     newTrack.enabled = true;

  //     // add the new track to the merged stream
  //     videoTracks.push(newTrack);
  //     mergedStream.addTrack(newTrack);

  //     // call drawFrame again to capture the next frame
  //     requestAnimationFrame(drawFrame);
  //   }, 'video/webm');
  // }

  const createCameraPopup = ({ videoSrc }: { videoSrc: MediaStream }) => {
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

  overlay = document.createElement('div');
  //overlay styles
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = '#272A35';
  overlay.style.opacity = '.4';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  1;

  document.body.style.width = '100vw';
  document.body.style.position = 'fixed';

  document.body.appendChild(overlay);

  // control menu
  box = document.createElement('div');
  box.style.width = '300px';
  box.style.height = '65px';
  box.style.backgroundColor = '#1B72E8';
  box.style.position = 'absolute';
  box.style.marginLeft = 'auto';
  box.style.marginRight = 'auto';
  box.style.bottom = '5%';
  box.style.left = '0';
  box.style.right = '0';
  box.style.borderRadius = '4px';
  box.textContent = 'Record';

  // append controls on the overlay
  overlay.appendChild(box);

  box.addEventListener('click', async () => {
    // remove overlay and options/settings containers and all constraints
    document.body.style.width = '100vw';
    document.body.style.position = 'relative';
    overlay.removeChild(box);
    document.body.removeChild(overlay);

    // get access to user's camera and microphone
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (err) {
      alert('You need to grant us permission to use camera and microphone to record.');
      throw new Error('Access denied by user for Camera and microphone.');
    }

    // getting screen capture streams
    screenStream = await startScreenCapture({
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
    cameraStream = await startCameraCapture({
      audio: true,
      video: true,
    });

    screenShareVideoEl = document.createElement('video');
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

    createCameraPopup({ videoSrc: new MediaStream(cameraStream.getTracks()) });

    // combineStreamToCanvas();

    // const mergedStream = canvasEl.captureStream();

    // showing live self camera feed popup

    //********************************** */

    // const testVideoMergeStreamEl = document.createElement('video');
    // testVideoMergeStreamEl.srcObject = mergedStream;
    // testVideoMergeStreamEl.style.height = '30em';
    // testVideoMergeStreamEl.style.width = '30em';
    // testVideoMergeStreamEl.style.position = 'fixed';
    // testVideoMergeStreamEl.style.top = '20%';
    // testVideoMergeStreamEl.style.left = '50%';
    // testVideoMergeStreamEl.muted = true;
    // testVideoMergeStreamEl.playsInline = true;
    // testVideoMergeStreamEl.onloadedmetadata = async () => {
    //   await testVideoMergeStreamEl.play();
    // };

    // document.body.appendChild(testVideoMergeStreamEl);

    //********************************** */

    // getting the video for all merged tracks
    mediaRecorder = new MediaRecorder(screenStream, {
      mimeType: 'video/webm',
    });

    mediaRecorder.ondataavailable = (ev) => {
      console.log('🚀 ~ file: background.ts:159 ~ box.addEventListener ~ on-data-available:', ev.data);

      videoChunks.push(ev.data);
    };

    mediaRecorder.onstop = async (ev) => {
      console.log('media-recorder event', ev);
      console.log('Video chunks', videoChunks);

      const videoString = await blobToDataURL(new Blob(videoChunks, { type: videoChunks[0].type }));

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
  });
};

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Clicked extension -recorder');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: openRecorder,
  });
});
