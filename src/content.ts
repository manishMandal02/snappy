// setTimeout(() => {
// chrome.tabs.query(
//   {
//     active: true,
//     currentWindow: true,
//   },
//   (tabs) => {
//     console.log('tabs', tabs[0]);
//   }
// );
// }, 2000);

// setTimeout(async () => {
(async () => {
  try {
    localStorage.removeItem('videoData');
    const videoData = await chrome.storage.local.get('video');
    console.log('videoData from extension storage', videoData);
    localStorage.setItem('videoData', videoData.video);
  } catch (error) {
    console.log(error);
  }
})();
// }, 2000);
