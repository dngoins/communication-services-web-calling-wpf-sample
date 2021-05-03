import React from "react";
import { DefaultButton } from 'office-ui-fabric-react'
import { Icon } from '@fluentui/react/lib/Icon';
import { LocalVideoStream, VideoStreamRenderer } from '@azure/communication-calling';
import StreamMedia from '../MakeCall/StreamMedia'

    


export default class CallCard extends React.Component {
    constructor(props) {
        super(props);
        this.mutePromise = undefined;
        this.placeCallOptions = null;
        this.localVideo = null;
        this.localVideoStream = null;
        this.rendererLocal = null;
        this.rendererRemote = null;
        this.incomingCall = null;
       
        this.state = {
            call: props.call,
            dir: props.dir,
            deviceManager: props.deviceManager,
            callState: props.call.state,
            callId: props.call.id,
            micOn: true
        };
       
    }

    async clearVideo()
    {
        if( this.rendererLocal)
                this.rendererLocal.dispose();
        
            if (this.rendererRemote)
                this.rendererRemote.dispose();

            this.localVideoStream = null;
            this.rendererLocal = null;
            this.rendererRemote = null;
            console.log("clearing Video");
    }

    async localVideoView() {
        this.rendererLocal = new VideoStreamRenderer(this.localVideoStream);
        const view = await this.rendererLocal.createView();
        document.getElementById("myVideo").appendChild(view.target);
        console.log('localVideoView success');
      }
      
      async remoteVideoView(remoteVideoStream) {
        this.rendererRemote = new VideoStreamRenderer(remoteVideoStream);
        const view = await this.rendererRemote.createView();
        document.getElementById("remoteVideo").appendChild(view.target);
        console.log('removeVideoView success');
      }

      async handleVideoStream(remoteVideoStream) {
        remoteVideoStream.on('isAvailableChanged', async () => {
          if (remoteVideoStream.isAvailable) {
              await this.remoteVideoView(remoteVideoStream);
          } else {
              if(this.renderRemote)
                this.rendererRemote.dispose();
          }
        });
        if (remoteVideoStream.isAvailable) {
          await this.remoteVideoView(remoteVideoStream);
        }
      }

    async subscribeToParticipantVideoStreams(remoteParticipant) {
        remoteParticipant.on('videoStreamsUpdated', e => {
          e.added.forEach(v => {
            this.handleVideoStream(v);
          })
        });
        remoteParticipant.videoStreams.forEach(v => {
          this.handleVideoStream(v);
        });
        
        console.log('Subscribe To Participant video success');
      }
      
    async subscribeToRemoteParticipantInCall(callInstance) {
        callInstance.on('remoteParticipantsUpdated', e => {
          e.added.forEach( p => {
            this.subscribeToParticipantVideoStreams(p);
          })
        }); 
        callInstance.remoteParticipants.forEach( p => {
          this.subscribeToParticipantVideoStreams(p);
        });
        console.log('subscribe to remote participant success');

      }

    onCallStateChanged() {
        console.log('stateChanged', this.state.call.state);
        const _callState = this.state.call.state;
        const _dir = this.state.call.direction;

        this.setState({callState: this.state.call.state});
        console.log('stateChangedDirection', this.state.call.direction);
        this.state.call.on('stateChanged', this.onCallStateChanged);
        this.state.call.on('idChanged', () => {
            this.setState({ callId: this.state.call.id});
            console.log( this.state.call.id)
        });

        if ((_callState === "Connecting" ) && (_dir === "Incoming"))
        {
            console.log("changed to onCallStateChange - Connected");
            //this.state.call.state = "Connected";
            const addedCall = this.state.call;
            this.subscribeToRemoteParticipantInCall(addedCall); 
              
        }

        if(_callState === "Disconnected")
        {
            if( this.rendererLocal)
                this.rendererLocal.dispose();
        
            if (this.rendererRemote)
                this.rendererRemote.dispose();

            this.localVideoStream = null;
            this.rendererLocal = null;
            this.rendererRemote = null;
            this.clearVideo();

            console.log("Disconnected - cleared out video");
        }
    }

    componentDidMount() {
        const onCallStateChanged = () => {
            console.log('componentDidMount::stateChanged', this.state.call.state);
            this.setState({callState: this.state.call.state});
            console.log('componentDidMount::stateChangedDirection', this.state.call.direction);
            const _callState = this.state.call.state;
            if(_callState === "Connected")
            {
                console.log("componentDidMount::onCallStateChange - Connected");
                const addedCall = this.state.call;
                this.subscribeToRemoteParticipantInCall(addedCall); 
                    
            }

            if(_callState === "Disconnected")
            {
                if( this.rendererLocal)
                    this.rendererLocal.dispose();
            
                if (this.rendererRemote)
                    this.rendererRemote.dispose();
    
                this.localVideoStream = null;
                this.rendererLocal = null;
                this.rendererRemote = null;
                this.clearVideo();
    
                console.log("componentDidMount::onCallStateChange Disconnected - cleared out video");
            }
        }
        onCallStateChanged();
        this.state.call.on('stateChanged', onCallStateChanged);
        this.state.call.on('idChanged', () => {
            this.setState({ callId: this.state.call.id});
            console.log( "comopnentDidMount:", this.state.call.id)
        });
    }

    async handleAcceptCall() {

        const speakers = await this.state.deviceManager.getSpeakers();
        const speakerDevice = speakers[0];
        if(!speakerDevice || speakerDevice.id === 'speaker:') {
            this.props.onShowSpeakerNotFoundWarning(true);
        } else if(speakerDevice) {
            await this.state.deviceManager.selectSpeaker(speakerDevice);
        }

        const mics = this.state.deviceManager.getMicrophones();
        const microphoneDevice = mics[0];
        if(!microphoneDevice || microphoneDevice.id === 'microphone:') {
            this.props.onShowMicrophoneNotFoundWarning(true);
        } else {
            await this.state.deviceManager.selectMicrophone(microphoneDevice);
        }

        this.placeCallOptions = { localVideoStreams: undefined};
        const cameras =  await this.state.deviceManager.getCameras();
        console.log(cameras);
        const camera = cameras[0];
        //let localVideoStream = null;
        
        if(!camera)
        {
            // this.state.deviceManager.showCameraNotFoundWarning(true);
            this.props.onShowCameraNotFoundWarning(true);
            console.log('could not find camera or it is in use');
        }
        else
        {        
           this.localVideoStream = new LocalVideoStream(camera);        
           this.placeCallOptions = { localVideoStreams: [this.localVideoStream]};
           console.log(`handleAccecptCall - CallCard CameraName: ${camera.name}`);
           await this.localVideoView();
        }
            
        this.incomingCall = await this.state.call.accept({
            videoOptions: this.placeCallOptions
        });
        

        //.catch((e) => console.error(e));
        this.incomingCall.on('stateChanged', this.onCallStateChanged);
        this.setState( {call: this.incomingCall, callState: "Connected", dir: ""});
        console.log(`Handle Accept Call: ${this.state.call}`);
        this.onCallStateChanged();
        this.setState( {call: this.incomingCall, callState: "Connected"});
        this.state.call.on('stateChanged', this.onCallStateChanged);
        
    }

    getIncomingActionContent() {
        return (
            <>
                <DefaultButton
                    className="answer-button my-3"
                    onClick={() => this.handleAcceptCall()}>
                    <i className="fas fa-phone"></i>Accept
                </DefaultButton>
            </>
        );
    }

    handleMicOnOff() {
        try {
            if(!this.mutePromise) {
                if (this.state.micOn) {
                    this.mutePromise = this.state.call.mute().then(() => {
                        this.setState({micOn: false});
                        this.mutePromise = undefined;
                    });
                } else {
                    this.mutePromise = this.state.call.unmute().then(() => {
                        this.setState({micOn: true});
                        this.mutePromise = undefined;
                    });
                }
            }
        } catch(e) {
            this.mutePromise = undefined;
            console.error(e);
        }
    }

    render() {
        return (
            <div className="ms-Grid mt-2">
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg6">
                        <h2>{this.state.callState !== 'Connected' ? `${this.state.callState}...` : `Connected`}</h2>
                        
                    </div>
                    <div className="ms-Grid-col ms-lg6 text-right">
                        {
                            this.state.call &&
                            <h2>Call Id: {this.state.callId}</h2>
                        }
                    </div>
                </div>
                <div className="ms-Grid-row">
                    <div className="ms-Grid-col ms-lg12">
                        <div className="my-4">
                            {
                                this.state.callState !== 'Connected' &&
                                <div className="custom-row">
                                    <div className="ringing-loader mb-4"></div>
                                </div>                                
                            }
                            <div className="text-center">
                                    <span className="in-call-button"
                                        title={`${this.state.micOn ? 'Mute' : 'Unmute'} your microphone`}
                                        variant="secondary"
                                        onClick={() => this.handleMicOnOff()}>
                                        {
                                            this.state.micOn &&
                                            <Icon iconName="Microphone"/>
                                        }
                                        {
                                            !this.state.micOn &&
                                            <Icon iconName="MicOff2"/>
                                        }
                                    </span>
                                    <span className="in-call-button"
                                        onClick={
                                            () => {
                                                this.state.call.hangUp({forEveryone: false}).catch((e) => console.error(e));
                                                this.clearVideo();
                                            }                                            
                                            }>
                                        <Icon iconName="DeclineCall"/>
                                    </span>
                            </div>
                            <div className="text-center">
                            {
                                this.state.dir === 'Incoming' ? this.getIncomingActionContent() : undefined
                            }
                            </div>
                            
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}