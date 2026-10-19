export function isMobileDevice(device) {
  if (!device) return false;

  const userAgent = device.userAgent || "";
  if (/iPhone|iPad|iPod|Android|Windows Phone/i.test(userAgent)) return true;

  // iPadOS can identify itself as macOS, including when requesting desktop sites.
  if (/Macintosh/i.test(userAgent) && device.maxTouchPoints > 1) return true;

  return device.userAgentData?.mobile === true;
}
