import fetch from "node-fetch"
import { Context } from "telegraf";
import FormData from "form-data"

import filters from "./filters.js";

/**
 * 
 * @param {Context} ctx 
 * @returns {Array}
 */
async function evaluate(ctx) {
  if (ctx.message.sticker.is_animated || ctx.message.sticker.is_video) return [{ error: "animated" }];

  try {
    let link = await ctx.telegram.getFileLink(ctx.message.sticker.file_id);

    const sticker_res = await fetch(link);
    const sticker_data = (await sticker_res.buffer());

    const form = new FormData();

    form.append("image", sticker_data, "image.png");

    const upload_res = await fetch("https://pawgge.rs/api/image", {
      method: "POST",
      body: form,
    });

    const upload_data = await upload_res.json();

    const result = await fetch(`https://pawgge.rs/api/result?file_md5=${upload_data.file_md5}`);
    const enddata = await result.json();

    return enddata.result;
  } catch (e) {
    console.log(e);
    return [{ error: "other" }];
  }
}

/**
 * @returns {Boolean}
 */
async function isAllowed(evaluation) {
  let val = true;
  for (const obj of evaluation) {
    if (filters.disallow.includes(obj.tag)) { val = false };
  }
  return val;
}

export default {
  evaluate,
  isAllowed
}