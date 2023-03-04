let box: HTMLDivElement;
let overlay: HTMLDivElement;
let cameraStreamVideoEl: HTMLVideoElement;
let screenSteamVIdeoEl: HTMLVideoElement;
let screenStream: MediaStream;
let cameraStream: MediaStream;
let streamMaxWidth: number;
let streamMaxHeight: number;
let mergedStream: MediaStream;
let videoTracks: MediaStreamTrack[];

// canvas element to merge the videos
const canvasEl = document.createElement('canvas');
const canvasCtx = canvasEl.getContext('2d')!;

const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (_e) => resolve(reader.result as string);
    reader.onerror = (_e) => reject(reader.error);
    reader.onabort = (_e) => reject(new Error('Read aborted'));
    reader.readAsDataURL(blob);
  });
};

// copied code
/**
 * Internal Polyfill to simulate
 * window.requestAnimationFrame
 * since the browser will kill canvas
 * drawing when tab is inactive
 */
const requestVideoFrame = (callback: (date: number) => void) => {
  return window.setTimeout(function () {
    callback(Date.now());
  }, 1000 / 60); // 60 fps - just like requestAnimationFrame
};

// copied code
/**
 * Internal polyfill to simulate
 * window.cancelAnimationFrame
 */
const cancelVideoFrame = function (id: string) {
  clearTimeout(id);
};

const startScreenCapture = async (displayMediaOptions: DisplayMediaStreamOptions) => {
  let screenStream = null;

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
  } catch (err) {
    console.error(`Error: ${err}`);
  }
  return screenStream;
};

const startCameraCapture = async (constraints?: MediaStreamConstraints) => {
  let cameraStream = null;

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.error(`Error: ${err}`);
  }
  return cameraStream;
};

// capture frames from each video stream and draw them onto the canvas
function drawFrame() {
  canvasCtx.save();
  canvasEl.setAttribute('width', `${streamMaxWidth}px`);
  canvasEl.setAttribute('height', `${streamMaxHeight}px`);
  canvasCtx.drawImage(screenSteamVIdeoEl, 0, 0, streamMaxWidth, streamMaxHeight);
  canvasCtx.drawImage(cameraStreamVideoEl, 10, 10, 8, 8);

  // convert the canvas to a blob and create a new video track
  canvasEl.toBlob((blob) => {
    const newTrack = new MediaStreamTrack();

    newTrack.enabled = true;

    // add the new track to the merged stream
    videoTracks.push(newTrack);
    mergedStream.addTrack(newTrack);

    // call drawFrame again to capture the next frame
    requestAnimationFrame(drawFrame);
  }, 'video/webm');
}

const mergeStreams = () => {
  // set the canvas size to the dimensions of the the screen
  streamMaxHeight = screenStream.getVideoTracks()[0].getSettings().height!;
  streamMaxWidth = screenStream.getVideoTracks()[0].getSettings().width!;
  // canvas.width = streamMaxWidth;
  // canvas.height = streamMaxHeight;
};

const createCameraPopup = ({ videoSrc }: { videoSrc: MediaStream }) => {
  // parent container for popup
  // const cameraPopup = document.createElement('div');
  // cameraPopup.style.backgroundColor = '#7477FF';
  // cameraPopup.style.width = '15rem';
  // cameraPopup.style.height = '15rem';
  // cameraPopup.style.borderRadius = '50%';
  // cameraPopup.style.position = 'fixed';
  // cameraPopup.style.left = '10%';
  // cameraPopup.style.bottom = '10%';
  // cameraPopup.style.cursor = 'move';
  // cameraPopup.style.userSelect = 'none';
  // cameraPopup.draggable = true;

  // document.body.appendChild(cameraPopup);

  // video container to show live video stream from camera
  cameraStreamVideoEl = document.createElement('video');
  cameraStreamVideoEl.style.width = '15rem';
  cameraStreamVideoEl.style.height = '15rem';
  cameraStreamVideoEl.style.position = 'fixed';
  cameraStreamVideoEl.style.borderRadius = '50%';
  cameraStreamVideoEl.style.objectFit = 'cover';
  cameraStreamVideoEl.srcObject = videoSrc;
  cameraStreamVideoEl.muted = true;
  cameraStreamVideoEl.playsInline = true;
  cameraStreamVideoEl.onloadedmetadata = () => {
    cameraStreamVideoEl.play();
  };

  document.body.appendChild(cameraStreamVideoEl);
};

const openRecorder = () => {
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

    const videoChunks: Blob[] = [];

    // get access to user's camera and microphone
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (err) {
      alert('You need to grant us permission to use camera and microphone to record.');
      throw new Error('Access denied by user for Camera and microphone.');
    }

    // getting screen capture streams
    const screenStream = await startScreenCapture({ 
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
    const cameraStream = await startCameraCapture({
      audio: true,
      video: true,
      // video: { width: 1280, height: 720 },
    });

    if (!screenStream) {
      throw new Error('Not able to capture screen.');
    }

    if (!cameraStream) {
      throw new Error('Not able to capture camera & microphone.');
    }

    // showing live self camera feed popup
    createCameraPopup({ videoSrc: new MediaStream(cameraStream.getTracks()) });

    // merging screen, camera and audio tracks in one
    const mergedStream = new MediaStream();

    screenStream.getTracks().forEach((tracks) => mergedStream.addTrack(tracks));
    cameraStream.getTracks().forEach((tracks) => mergedStream.addTrack(tracks));

    console.log('🚀 ~ file: background.ts:155 ~ box.addEventListener ~ mergedStream:', mergedStream);

    // getting the video for all merged tracks
    const mediaRecorder = new MediaRecorder(mergedStream, { mimeType: 'video/webm' });
    mediaRecorder.ondataavailable = (ev) => {
      console.log('🚀 ~ file: background.ts:159 ~ box.addEventListener ~ on-data-available:', ev.data);

      videoChunks.push(ev.data);
    };
    mediaRecorder.start();

    const screenMediaRecorder = new MediaRecorder(screenStream);

    screenMediaRecorder.onstop = async (ev) => {
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
  });
};

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Clicked extension -recorder');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: openRecorder,
  });
});
