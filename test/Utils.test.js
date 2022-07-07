import Utils from "../lib/Utils";

test("Download function test", async () => {
    expect.assertions(1);
    const response = await Utils.download("https://api.delijn.be/gtfs/v1/realtime", {
        "Ocp-Apim-Subscription-Key": "cf97c65afbe84e0c8e20142f4cb62119"
    });
    expect(response).toBeDefined();
});