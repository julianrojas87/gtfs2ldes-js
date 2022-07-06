import { GtfsIndex } from "gtfsrt2lc";

export const buildIndexes = async config => {
    const staticDataPath = config["general"].data_folder;
    return await new GtfsIndex({ path: staticDataPath })
        .getIndexes({ store: "LevelStore"});
}

export const processGTFSRealtime = config => {

}