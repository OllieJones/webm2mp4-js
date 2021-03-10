# fragmented-mp4 [![Tests](https://github.com/OllieJones/webm2mp4-js/actions/workflows/node.js.yml/badge.svg)](https://github.com/OllieJones/fragmented-mp4-output/actions/workflows/node.js.yml) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com) 

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

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save webm2mp4-js
```

Installation with other package managers works similarly.

## Why this package
 
## Writing Fragmented MP4 streams

Start by including the module in your program.

```js
const Fmp4 = require('fragmented-mp4')
```

Create an anonymous top-level MP4 box for the whole output datastream,
and set up an `ondataavailable` handler. The handler has the
same function signature as
[MediaRecorder's `ondataavailble` handler](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/ondataavailable). 


```js
const blobChunks = []
const streamBox = new Fmp4.Box(null, null, {type:'video/webm; codecs="avc1.42C01E"'})
streamBox.ondataavailable = function(event) {
  blobChunks.push(event.data)
}
```

Then create a box within the streamBox for the `ftyp` atom that comes at the beginning
of the file.  Write the elements of the atom into it.

```js
const ftyp = new Fmp4.Box('ftyp', streamBox)
ftyp.fourcc('mp42', 'major_brand')
ftyp.uint32(1, 'minor_version')
ftyp.fourcc(['isom', 'mp42','avc1'], 'compatible_brand')
ftyp.end()
```

Then create another box for the `moov` atom and start filling it in.
```js
const moov = new Fmp4.Box('moov', streamBox)
const mvhd = new Fmp4.Box('mvhd', moov)
mvhd.uint8(timescale, 'timescale')
mvhd.uint8(0, 'duration')
mvhd.uint8(0, 'duration(ms)')
mvhd.end()
const trak = new  Fmp4.Box('trak', moov)
const tkhd = new  Fmp4.Box('tkhd', trak)
//and so forth
```

When done with any box, always invoke `.end()`.

### Box class

A Box represents a single MP4 atom. It can contain raw data or other atoms.

Its constructor looks like this:

```js
const box = new Box(fourccBoxName, parentBox, {options})
```

If a box has no parent box, it is a top-level box.
Top-level boxes must have `.ondataavailable` handlers or they won't be useful.

You may specify the MIME type of the intended output in the options with 
`{type: mimeType}`.

If a box has a parent box, it emits its output to that parent box.

Output functions include:

```js
box.fourcc('aaaa', 'description') /* writes a four-character code into the box */
box.uint8(val, 'description')     /* writes an 8-bit value or array of 8-bit values to the box */
box.uint16(val, 'description')    /* a 16-bit value or array of the same */
box.uint32(val, 'description')    /* a 32-bit value or array of the same */
box.nulls(count, 'description')   /* a number of 8-bit nulls, for an empty box, as needed */
```

When all data to a box has been output, use the end method.
```js
box.end()
```

You may obtain the length of a written box at any time with 

```js
const length = box.length()
```



## Still to do

* Javascript stream support

## Credits
