"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeEmoteMessage = makeEmoteMessage;
exports.makeHtmlEmote = makeHtmlEmote;
exports.makeHtmlMessage = makeHtmlMessage;
exports.makeHtmlNotice = makeHtmlNotice;
exports.makeNotice = makeNotice;
exports.makeTextMessage = makeTextMessage;

var _event = require("./@types/event");

/*
Copyright 2018 New Vector Ltd
Copyright 2018 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/** @module ContentHelpers */

/**
 * Generates the content for a HTML Message event
 * @param {string} body the plaintext body of the message
 * @param {string} htmlBody the HTML representation of the message
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */
function makeHtmlMessage(body, htmlBody) {
  return {
    msgtype: _event.MsgType.Text,
    format: "org.matrix.custom.html",
    body: body,
    formatted_body: htmlBody
  };
}
/**
 * Generates the content for a HTML Notice event
 * @param {string} body the plaintext body of the notice
 * @param {string} htmlBody the HTML representation of the notice
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */


function makeHtmlNotice(body, htmlBody) {
  return {
    msgtype: _event.MsgType.Notice,
    format: "org.matrix.custom.html",
    body: body,
    formatted_body: htmlBody
  };
}
/**
 * Generates the content for a HTML Emote event
 * @param {string} body the plaintext body of the emote
 * @param {string} htmlBody the HTML representation of the emote
 * @returns {{msgtype: string, format: string, body: string, formatted_body: string}}
 */


function makeHtmlEmote(body, htmlBody) {
  return {
    msgtype: _event.MsgType.Emote,
    format: "org.matrix.custom.html",
    body: body,
    formatted_body: htmlBody
  };
}
/**
 * Generates the content for a Plaintext Message event
 * @param {string} body the plaintext body of the emote
 * @returns {{msgtype: string, body: string}}
 */


function makeTextMessage(body) {
  return {
    msgtype: _event.MsgType.Text,
    body: body
  };
}
/**
 * Generates the content for a Plaintext Notice event
 * @param {string} body the plaintext body of the notice
 * @returns {{msgtype: string, body: string}}
 */


function makeNotice(body) {
  return {
    msgtype: _event.MsgType.Notice,
    body: body
  };
}
/**
 * Generates the content for a Plaintext Emote event
 * @param {string} body the plaintext body of the emote
 * @returns {{msgtype: string, body: string}}
 */


function makeEmoteMessage(body) {
  return {
    msgtype: _event.MsgType.Emote,
    body: body
  };
}