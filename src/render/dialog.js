// The single modal dialog, used for confirmations, messages and text entry.

import {$} from './dom.js';

let pending = null;

/**
 * @param {string} title
 * @param {string} msg    may contain markup
 * @param {(value:any)=>void} [cb]  receives false on cancel, true on confirm,
 *                                  or the entered string when `opts.input` is set
 * @param {{input?:string, paste?:boolean, ok?:string, noCancel?:boolean, xOnly?:boolean}} [opts]
 */
export function ask(title, msg, cb, opts = {}) {
  $('dlgtitle').textContent = title;
  $('dlgmsg').innerHTML = msg || '';

  const paste = $('dlgpaste');
  if (opts.paste) {
    paste.style.display = 'block';
    paste.value = '';
    setTimeout(() => { try { paste.focus(); } catch { /* not focusable yet */ } }, 40);
  } else {
    paste.style.display = 'none';
  }

  const input = $('dlginput');
  if (opts.input !== undefined) {
    input.style.display = 'block';
    input.value = opts.input;
    setTimeout(() => { try { input.focus(); input.select(); } catch { /* not focusable yet */ } }, 40);
  } else {
    input.style.display = 'none';
  }

  $('dlgok').textContent = opts.ok || 'Confirm';
  $('dlgok').style.display = opts.xOnly ? 'none' : '';
  $('dlgno').style.display = (opts.noCancel || opts.xOnly) ? 'none' : '';
  $('dlgacts').style.display = opts.xOnly ? 'none' : '';

  pending = cb;
  $('dlg').classList.add('on');
}

export function dlgClose(value) {
  const cb = pending;
  pending = null;
  $('dlg').classList.remove('on');
  if (cb) cb(value);
}

/** A message with nothing to decide — dismissed with the close button only. */
export function notify(title, msg) {
  ask(title, msg, null, {xOnly: true});
}
