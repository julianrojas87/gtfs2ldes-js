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
                // Set LDES values
                conn.value["isVersionOf"] = conn.value["@id"];
                conn.value["@id"] += `#${timestamp}`;
                conn.value["generatedAtTime"] = timestamp;
                // Convert to NQuads
                const parsed = await JSONLD.toRDF({
                    "@context": context,
                    ...conn.value
                }, { format: "application/n-quads" });
                this.push(parsed);
            } else {
                count++;
            }
            done();
        },
    });
}