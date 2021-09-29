# Remote Radio
## Introduction

An open-source peer-to-peer audio streaming solution for community radio stations, podcasting and other purposes. Remote Radio uses WebRTC - via the PeerJS library - to allow connection between multiple computers to record and broadcast live. 

***
## Uses
### Studio Link/OB Mode
You can use it on remote broadcasts to send audio to the main studio. Set up sever on studio computer with unique ID. Connect remote computers to  the server computer. No need to set up static IPs.

### Call-In Queue
Have people call the studios in a queue system. Set up server page. Distribute unique ID to audience either explicitly or
through code on a website or app.

### Self-contained Studio
Present a show live to air from your own home/remote location. Use our basic website to perform a live show direct to the studio remotely, 

Other setups could include the use a piece of software such as [Virtual Audio Cable](https://www.vb-audio.com/Cable/?fbclid=IwAR3RTzXAPhG84X6R-EHyZ7oAlXnoa5kx2svtVaSZJmrnvQc6VwzDRiM7_PY) or [Black Hole](https://blackhole.com) (Mac only) to route the output of your playout software e.g. [Mixxx](https://mixxx.org) to Remote Radio in OB mode.

### Direct Mode

If you are sent a link to record a show, you will see a stripped down interface.

## Getting Started
In order to start firstly you must enable audio in your browser for the Remote Radio web page. In Chrome this is done by clicking allow on the dialogue box which appears when the page first loads.

After you have enabled audio the user interface will appear. Copy the link from the text box. Send this to the peer you wish to connect with via email, sms or your preferred means. Press the connect  button to start audio transfer.

### Design Philosophy

RR is designed to work with JS6 - classes. As WebRTC is an experimental API. Also uses Dialog API and MediaRecorder API.

![RR Design](C:\Users\jerry\OneDrive - Falmouth University\PhD\Software\RemoteRadioServerArch.jpg)

Simplicity is at the heart of the interface, which takes cues from Mixxx, amongst others. This comes from years of experience training non-technical people in the arts of broadcasting.

## Installation

You can pre-record a show or podcast simply. On your own you can just load up your songs, set up your mic, hit record and go.

To include a remote guest, send the link, wait for them to join you and record and go.

To broadcast to air, connect to the main studio and away you go...

### Server Side

If you are using Remote Radio in your radio station, you will need to configure the server end to make it possible to stream live audio.

Configure: server id

### Issues

Needs more robustness.

### Future Features

The intention is to allow

- Talkback channels to allow presenters to talk to each other during playback of songs, or communication during OBs.
- Messaging/chat service
- Multi-track recording. Each stream recorded to a separate channel in RRRecorder to allow for better editing/post-production possibilities.



## Credits
Remote Radio was created by Jerry Padfield as part of PhD research at [Falmouth University](http://www.falmouth.ac.uk) into ways to broaden participation in community radio using open source software, convergence culture and digital technology. The user interface was developed in collaboration with [Joskaude Pakalkaite](http://joskaudepakalkaite.com)

Remote Radio uses [peer.js](http://peer.js) , [feather icons](http://) (MIT license), [volume meter]() by Chris Wilson under the MIT license.

Remote Radio is released under the MIT license.

## Licenses
### MIT
The MIT License (MIT)

Copyright (c) 2013-2017 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### Creative Commons

