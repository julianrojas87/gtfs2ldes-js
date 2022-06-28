import { URL } from 'url';
import { request } from 'undici';
import unzipper from 'unzipper';

function downloadAndUnzip(url, headers, output) {
   return new Promise(async (resolve, reject) => {
      const checkUrl = new URL(url);
      if (checkUrl) {
         const res = await request(url, {
            method: "GET",
            headers
         });
         if (res.statusCode >= 400) {
            res.body.pipe(unzipper.Parse({ path: output }))
               .on("end", resolve());
         } else {
            reject(`HTTP error (${res.statusCode}) while requesting: ${url}`);
         }
      } else {
         reject(`Invalid URL: ${url}`);
      }
   });
}

export default {
   downloadAndUnzip
}