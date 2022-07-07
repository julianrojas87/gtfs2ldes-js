import { Transform } from "stream";
import JSONLD from "jsonld";

export const RDFFormatter = (context, timestamp) => {
    // Counter to skip the first object as it corresponds to the @context
    // emitted by gtfs2lc and we have our own context here.
    let count = 0;
    return new Transform({
        readableObjectMode: true,
        writableObjectMode: true,

        async transform(conn, encoding, done) {
            if (count > 0) {
                const obj = conn.value ? conn.value : conn;
                // Set LDES values
                obj["isVersionOf"] = obj["@id"];
                obj["@id"] += `#${timestamp}`;
                obj["generatedAtTime"] = timestamp;
                // Convert to NQuads
                const parsed = await JSONLD.toRDF({
                    "@context": context,
                    ...obj
                }, { format: "application/n-quads" });
                this.push(parsed);
            } else {
                count++;
            }
            done();
        },
    });
}