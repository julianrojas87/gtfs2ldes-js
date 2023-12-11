import { jest, test, expect, afterEach } from "@jest/globals";
import { deleteAsync } from "del";
import fs from "fs";
import Utils from "../lib/Utils";

jest.setTimeout(15000);

test("Download function test", async () => {
    const response = await Utils.download("https://api.delijn.be/gtfs/v1/realtime", {
        "Ocp-Apim-Subscription-Key": "cf97c65afbe84e0c8e20142f4cb62119"
    });
    expect(response).toBe("/tmp/gtfs.zip");
});

test("Unzip function from URL", async () => {
    const path = await Utils.download("https://www.rtd-denver.com/files/gtfs/bustang-co-us.zip");
    expect(path).toBe("/tmp/gtfs.zip");
    Utils.unzip(path, "/tmp/unzipped");
    expect(fs.existsSync("/tmp/unzipped")).toBeTruthy();
});

afterEach(async () => {
    await deleteAsync([
        "/tmp/gtfs.zip",
        "/tmp/unzipped"
    ], { force: true });
});