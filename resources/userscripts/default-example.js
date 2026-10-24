// ==UserScript==
// @name         Default example
// @author       you
// @version      1.0.0
// @description  Ships inside the client and runs from the first start. Safe to edit or delete
// @run-at       document-end
// @license      MIT
// ==/UserScript==

// This script is built into the client (see SHIPPED in src/modules/userscripts.rs). The first time the client starts
// it copies this file into Documents\<your client name>\userscripts, where you can edit or delete it.
// A copy you edited or deleted is never put back.
//
// It only writes one line to the console. Open the developer tools (F12) to see it.
// Replace the line below with your own code, or delete this file and drop your own .js files into the folder.
//
// Helpers a script can use (Crankshaft shape):
//   this._console              the real console (Krunker replaces the page's one later)
//   this._css(css, id, on)     switches a stylesheet on or off

this._console.log("[userscripts] default example is running");
