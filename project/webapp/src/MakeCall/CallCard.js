import React from "react";
import { DefaultButton } from 'office-ui-fabric-react'
import { Icon } from '@fluentui/react/lib/Icon';
import { CallClient, LocalVideoStream } from '@azure/communication-calling';
import StreamMedia from '../MakeCall/StreamMedia'

export default class CallCard extends React.Component {
    constructor(props) {
        super(props);
        this.mutePromise = undefined;
        this.placeCallOptions = null;
        this.localVideo = null;

        this.state = {
            call: props.call,
            dir: props.dir,
            deviceManager: props.deviceManager,
            callState: props.call.state,
            callId: props.call.id,
            micOn: true
        };
    }

    onCallStateChanged() {
        console.log('stateChanged', this.state.call.state);
        this.setState({callState: this.state.call.state});
        console.log('stateChangedDirection', this.state.call.direction);
        this.state.call.on('stateChanged', this.onCallStateChanged);
        this.state.call.on('idChanged', () => {
            this.setState({ callId: this.state.call.id});
            console.log( this.state.call.id)
        });
    }

    componentDidMount() {
        const onCallStateChanged = () => {
            console.log('stateChanged', this.state.call.state);
            this.setState({callState: this.state.call.state});
            console.log('stateChangedDirection', this.state.call.direction);
        }
        onCallStateChanged();
        this.state.call.on('stateChanged', onCallStateChanged);
        this.state.call.on('idChanged', () => {
            this.setState({ callId: this.state.call.id});
            console.log( this.state.call.id)
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
        const cameras = this.state.deviceManager.getCameras();
        const camera = cameras[3];
        //let localVideoStream = null;
        
        if(!camera)
        {
            // this.state.deviceManager.showCameraNotFoundWarning(true);
            this.props.onShowCameraNotFoundWarning(true);
        }
        else
        {        
           const localVideoStream = new LocalVideoStream(camera);        
           this.placeCallOptions = { localVideoStreams: [localVideoStream]};
           console.log(`CallCard: ${camera.name}`);
        }
            
        const call = await this.state.call.accept({
            videoOptions: this.placeCallOptions
        });
        
        //.catch((e) => console.error(e));
        
        this.setState( {call: call, callState: "Connected", dir: ""});
        console.log(`Handle Accept Call: ${this.state.call}`);
        this.onCallStateChanged();
        this.setState( {call: call, callState: "Connected"});
        
        // await this.subscribeToRemoteParticipantInCall(addedCall);      
        
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
                                        onClick={() => this.state.call.hangUp({forEveryone: false}).catch((e) => console.error(e))}>
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