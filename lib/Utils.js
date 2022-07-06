import { URL } from 'url';
import { request } from 'undici';
import unzipper from 'unzipper';

async function download(url, headers) {
   const checkUrl = new URL(url);
   if (["http:", "https:"].includes(checkUrl.protocol)) {
      const res = await request(url, {
         method: "GET",
         headers
      });

      if (res.statusCode <= 400) {
         console.log(`Downloading ${url} ...`);
         return res.body;
      } else {
         throw new Error(`HTTP error (${res.statusCode}) while requesting: ${url}`);
      }
   } else {
      throw new Error(`Invalid URL: ${url}`);
   }

}

function unzip(stream, path) {
   return new Promise((resolve, reject) => {
      console.log("Decompressing GTFS source...");
      stream.pipe(unzipper.Extract({ path }))
         .on("close", resolve)
         .on("error", reject);
   });
}

async function postConnection(conn, target) {
   const checkUrl = new URL(target);
   if (["http:", "https:"].includes(checkUrl.protocol)) {
      const res = await request(target, {
         method: "POST",
         headers: { "content-type": "text/plain" },
         headersTimeout: 60000,
         body: conn
      });
      if (res.statusCode >= 400) {
         throw new Error(`HTTP error (${res.statusCode}) while posting connection to ${target}`);
      }
   } else {
      throw new Error(`Invalid target URL: ${target}`);
   }
}

export default {
   download,
   unzip,
   postConnection
}