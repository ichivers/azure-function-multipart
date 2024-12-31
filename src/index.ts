import Busboy from "busboy";
import { HttpRequest } from "@azure/functions";
import { ParsedField } from "./types/parsed-field.type";
import { ParsedFile } from "./types/parsed-file.type";
import { ParsedMultipartFormData } from "./types/parsed-multipart-form-data.type";
import { Config } from "./types/config.type";

export default async function parseMultipartFormData(
  request: HttpRequest,
  options?: Config
): Promise<ParsedMultipartFormData> {
  return new Promise((resolve, reject) => {
    try {
      const fields: Promise<ParsedField>[] = [];
      const files: Promise<ParsedFile>[] = [];

      let busboy;
      if (options) {
        busboy = Busboy({
          headers: {
            'content-type': request.headers.get('content-type') ?? undefined
          },
          ...options,
        });
      } else {
        busboy = Busboy({
          headers: {
            'content-type': request.headers.get('content-type') ?? undefined
          }
        });
      }

      busboy.on(
        "file",
        function (name, stream, { filename, encoding, mimeType }) {
          const arrayBuffer: Buffer[] = [];
          stream.on("data", function (data) {
            arrayBuffer.push(data);
          });

          stream.on("end", function () {
            const bufferFile = Buffer.concat(arrayBuffer);
            files.push(
              new Promise((resolve) => {
                resolve({
                  name,
                  bufferFile,
                  filename,
                  encoding,
                  mimeType,
                });
              })
            );
          });
        }
      );

      busboy.on(
        "field",
        function (
          name,
          value,
          { nameTruncated, valueTruncated, encoding, mimeType }
        ) {
          fields.push(
            new Promise((resolve) => {
              resolve({
                name,
                value,
                nameTruncated,
                valueTruncated,
                encoding,
                mimeType,
              });
            })
          );
        }
      );

      busboy.on("finish", async function () {
        resolve({
          fields: await Promise.all(fields),
          files: await Promise.all(files),
        });
      });

      request.body?.getReader().read().then((rawBody) => {
        const body = Buffer.from(rawBody.value);
        busboy.end(body);
      });
    } catch (error) {
      reject(error);
    }
  });
}
