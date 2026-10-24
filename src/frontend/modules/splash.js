import splashImage from "../../../resources/splash.png";
import { ready } from "../client.js";

// sessionStorage lives as long as the client window, and joining a match reloads the page, so this shows once per client start
const SHOWN_KEY = "voidSplashShown";
const FADE_MS = 500;

/**
 * Just the picture, centered, no dark screen behind it, so a small image takes a small space and the game stays visible.
 * It is never enlarged: a small PNG is shown small, a big one is shrunk to fit `size`.
 *
 * @param {number} seconds
 * @param {number} size the most of the window width and height the picture may use, in percent
 */
function show(seconds, size){
    const image = new Image();
    image.src = splashImage;
    image.style.cssText =
        `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;max-width:${size}vw;max-height:${size}vh;width:auto;height:auto;object-fit:contain;border-radius:6px;box-shadow:0 10px 40px #000a;cursor:pointer;opacity:1;transition:opacity ${FADE_MS}ms ease`;
    document.body.append(image);

    const hide = () => {
        image.style.opacity = "0";
        setTimeout(() => image.remove(), FADE_MS + 50);
    };
    image.addEventListener("click", hide);
    setTimeout(hide, seconds * 1000);
}

// only krunker's main page, not the social or hub popups, and only the first load of this client start
if (location.pathname === "/" && sessionStorage.getItem(SHOWN_KEY) === null){
    sessionStorage.setItem(SHOWN_KEY, "1");
    ready.then((voidClient) => {
        const data = voidClient.settings?.data ?? {};
        if (data.splashScreen === false) return;
        const seconds = Math.min(10, Math.max(1, Number(data.splashSeconds) || 3));
        const size = Math.min(100, Math.max(10, Number(data.splashSize) || 40));
        show(seconds, size);
    });
}
