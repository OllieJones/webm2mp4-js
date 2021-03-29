# webm2mp4-js [![Tests](https://github.com/OllieJones/webm2mp4-js/actions/workflows/node.js.yml/badge.svg)](https://github.com/OllieJones/webm2mp4-js/actions/workflows/node.js.yml) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) 

[MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) emits
media data stream boxed in the 
[Matroska](https://www.matroska.org/technical/elements.html) (aka webm or EBML)
format. 
When using MediaRecorder with a MIME type like `video/webm; codecs="avc1.42C01E"`,
it's possible to strip off the Matroska boxing and wrap the data in 
fragmented MP4 boxing instead.

This is handy, because the [Media Source Extension](https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API)
cannot consume Matroska, but it can consume fragmented MP4.  Once we have that MP4, 
we can feed it to MSE chunk by chunk with the 
[SourceBuffer.appendBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer/appendBuffer) API. 

The output data stream is intended to comply with
the W3C's 
[ISO Base Media File Format specification](https://www.w3.org/2013/12/byte-stream-format-registry/isobmff-byte-stream-format.html#iso-media-segments).


## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save webm2mp4-js
```

Installation with other package managers works similarly.
 
## Writing Fragmented MP4 streams from your web app

Start by including the module in your program.

```js
const webm2mp4 = require('webm2mp4-js')
```

You then can use `webm2m4.TransboxingMediaRecorder` exactly as if it were native `MediaRecorder`.

For example
```js
async function go () {
  const stream = await navigator.getUserMedia ({video:true, audio: false})
  const options = {
        videoBitsPerSecond: 500_000,
        mimeType: 'video/mp4;codecs="avc1.42C01E"'
      }
  const mediaRecorder = new webm2m4.TransboxingMediaRecorder(stream, options)
  mediaRecorder.ondataavailable = function (event){
    /* here's your mp4 payload */
    const blob = event.data
  }
  mediaRecorder.start(10)  
}
```


## Still to do

* Something useful with audio

## Credits

* The crew who made the [ebml](https://www.npmjs.com/package/ebml) package.
* The creators of the Quicktime stream format.
