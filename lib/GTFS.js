import Utils from "./Utils.js";

export const processGTFS = async config => {
    try {
        console.log('Starting processing of GTFS source');
        // Download and decompress GTFS source
        await Utils.downloadAndUnzip(
            config["gtfs"].source,
            config["gtfs"].auth_headers || [],
            config["general"].data_folder || "./data"
        );
    } catch (err) {
        console.error(err);
    }
}