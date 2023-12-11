import { URL } from 'url';
import { request } from 'undici';
import { createWriteStream } from 'fs';
import AdmZip from "adm-zip";

function download(url, headers) {
   return new Promise(async (resolve, reject) => {

      const checkUrl = new URL(url);
      if (["http:", "https:"].includes(checkUrl.protocol)) {
         const res = await request(url, {
            method: "GET",
            headers,
            maxRedirections: 10
         });

         if (res.statusCode <= 400) {
            console.log(`Downloading ${url} ...`);
            res.body.pipe(createWriteStream("/tmp/gtfs.zip"))
               .on("finish", () => resolve("/tmp/gtfs.zip"));
         } else {
            reject(new Error(`HTTP error (${res.statusCode}) while requesting: ${url}`));
         }
      } else {
         reject(new Error(`Invalid URL: ${url}`));
      }
   });
}

function unzip(zipped, path) {
   console.log("Decompressing GTFS source...");
   const adm = new AdmZip(zipped);
   adm.extractAllTo(path, true);
}

async function postConnection(conn, target) {
   const checkUrl = new URL(target);
   if (["http:", "https:"].includes(checkUrl.protocol)) {
      const res = await request(target, {
         method: "POST",
         headers: { "content-type": "application/n-triples" },
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
