// Selectable Chat: lets you select and copy text from the in-game chat (bottom left). Style and code in this one file.
// Select with the mouse, then Ctrl+C. Works wherever the chat takes the mouse (the menu, or while the chat is open).
import { voidClient } from "../../client.js";

const STYLE_ID = "void_textSelectCSS";

/**
 * @param {boolean} enabled
 */
function toggle(enabled){
    const existing = document.getElementById(STYLE_ID);
    if (!enabled){
        existing?.remove();
        return;
    }
    if (existing) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "#chatHolder * { user-select: text }";
    document.head.append(style);
}

export default function textSelect(){
    voidClient.settings.toggleTextSelect = toggle;
    toggle(voidClient.settings.data.textSelect !== false);
}
