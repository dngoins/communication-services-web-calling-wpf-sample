import React from "react";
import { CallClient, LocalVideoStream, VideoStreamRenderer } from '@azure/communication-calling';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { CommunicationIdentityClient } from '@azure/communication-identity';


const config = require("../../config.json");

if(!config || !config.connectionString || config.connectionString.indexOf('endpoint=') === -1)
{
    throw new Error("Update `config.json` with connection string");
}

const communicationIdentityClient = new  CommunicationIdentityClient(config.connectionString);


import {
    PrimaryButton,
    TextField,
    MessageBar,
    MessageBarType
} from 'office-ui-fabric-react'
import { Icon } from '@fluentui/react/lib/Icon';
import CallCard from '../MakeCall/CallCard'

import { utils } from '../Utils/Utils';

export default class MakeCall extends React.Component {
    constructor(props) {
        super(props);
        this.callClient = null;
        this.callAgent = null;
        this.deviceManager = null;
        this.destinationUserIds = null;
        this.placeCallOptions = null;
        this.localVideoStream = null;
        this.rendererLocal = null;
        this.rendererRemote = null;
        this.call = null;
        this.callCard = { makeCall: this, callCard: true };

        this.state = {
            loggedIn: false,
            id: ''
        };
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


    async componentDidMount() {
        try {

            // Instantiate the identity client
            let identityResponse = await communicationIdentityClient.createUser();
            console.log(`\nCreated an identity with ID: ${identityResponse.communicationUserId}`);
           // my_comm_id.innerHTML = `<div><p>My Contact Id:</p><p>${identityResponse.communicationUserId}</p></div>`;

            let tokenResponse = await communicationIdentityClient.getToken(identityResponse, ["voip"]);
            const { token, expiresOn } = tokenResponse;
            console.log(`\nIssued an access token with 'voip' scope that expires at ${expiresOn}:`);
            console.log(token);

            const tokenCredential = new AzureCommunicationTokenCredential(token);

            this.setState({ id: identityResponse.communicationUserId });

            this.callClient = new CallClient();
            this.callAgent = await this.callClient.createCallAgent(tokenCredential, { displayName: 'optional ACS user name' });

            this.deviceManager = await this.callClient.getDeviceManager();
            await this.deviceManager.askDevicePermission(true, true);
            this.callAgent.on('callsUpdated', e => {

                console.log(`callsUpdated, added=${e.added}, removed=${e.removed}`);

                e.added.forEach(call => {
                    if (this.state.call && call.isIncoming) {
                        call.reject();
                        return;
                    }
                    this.setState({ call: call, callEndReason: undefined, callState: call.state })
                });

                e.removed.forEach(call => {
                    if (this.state.call && this.state.call === call) {
                        this.setState({
                            call: null,
                            callEndReason: this.state.call.callEndReason,
                            callState: call.state
                        });

                    }
                    console.log("makecall::componentDidMount::callsUpdated:: remove foreach callstate:", call.state);
                    if (call.state == "Disconnected")
                    {
                        if( this.rendererLocal)
                            this.rendererLocal.dispose();
                        
                        if (this.rendererRemote)
                            this.rendererRemote.dispose();
                            
                        this.localVideoStream = null;
                        this.rendererLocal = null;
                        this.rendererRemote = null;
                        this.call = null;
                                               
                        //document.getElementById("myVideo").innerHTML = null;
                        console.log("makecall::componentDidMount::callsUpdated::Cleared video objects");
                        location.reload();
                    }
                });
              

            });

            this.callAgent.on('incomingCall', async e => {
                
                this.setState ({ call: e.incomingCall, dir: 'Incoming' });
               
                console.log(`Incoming call: ${this.state.call}`);
                var callInfo = this.state.call.info;

                // Get information about caller
                var callerInfo = this.state.call.callerInfo
                console.log(`call info: ${callInfo} caller info: ${callerInfo}`);

              });
            
            this.setState({ loggedIn: true });
        } catch (e) {
            console.error(e);
        }
    } 

    placeCall = async () => {
        try {
            let identitiesToCall = [];
            const userIdsArray = this.destinationUserIds.value.split(',');

            userIdsArray.forEach((userId) => {
                if (userId) {
                    userId = userId.trim();
                    userId = { communicationUserId: userId };
                    if (!identitiesToCall.find(id => { return id === userId })) {
                        identitiesToCall.push(userId);
                    }
                }
            });

            const speakers = await this.deviceManager.getSpeakers();
            const speakerDevice = speakers[0];
            if(!speakerDevice || speakerDevice.id === 'speaker:') {
                this.setShowSpeakerNotFoundWarning(true);
            } else if(speakerDevice) {
                await this.deviceManager.selectSpeaker(speakerDevice);
            }
    
            const mics  = await this.deviceManager.getMicrophones();
            const microphoneDevice = mics[0];

            if(!microphoneDevice || microphoneDevice.id === 'microphone:') {
                this.setShowMicrophoneNotFoundWarning(true);
            } else {
                await this.deviceManager.selectMicrophone(microphoneDevice);
            }
            
            this.placeCallOptions = { localVideoStreams: undefined};
            const cams = await this.deviceManager.getCameras();
            console.log('Make Call Cams: ', cams);
            const camera = cams[3];
            
            if(!camera)
            {
                this.setShowCameraNotFoundWarning(true);                
            }
            else
            { 
                console.log(`Placing Call: ${camera.name}`);
               
                this.localVideoStream = new LocalVideoStream(camera);
                this.placeCallOptions = { localVideoStreams: [this.localVideoStream]};
                await this.localVideoView();
               
            }

            let callOptions = {
                videoOptions: this.placeCallOptions,
                audioOptions: {
                    muted: false
                }
            };

            this.call = await this.callAgent.startCall(identitiesToCall, callOptions);
            this.call.on("stateChanged", () => {
                console.log('makecall::placecall::stateChanged', e);
                const _callState = this.call.state;
                
                if(_callState === "Disconnected")
                {
                    if( this.rendererLocal)
                        this.rendererLocal.dispose();
                
                    if (this.rendererRemote)
                        this.rendererRemote.dispose();
        
                    this.localVideoStream = null;
                    this.rendererLocal = null;
                    this.rendererRemote = null;
                }
            });

            //await this.subscribeToRemoteParticipantInCall(call);      
            this.setState({call: this.call, callState: call.state});

        } catch (e) {
            console.log('Failed to place a call', e);
        }
    };

   
      
    
    setShowCameraNotFoundWarning(show) {
        this.setState({showCameraNotFoundWarning: show});
    }

    setShowSpeakerNotFoundWarning(show) {
        this.setState({showSpeakerNotFoundWarning: show});
    }

    setShowMicrophoneNotFoundWarning(show) {
        this.setState({showMicrophoneNotFoundWarning: show});
    }
    

    render() {
        return (
            <div className="card">
                <div className="ms-Grid">
                    <div className="ms-Grid-row">
                        <h2 className="ms-Grid-col ms-lg6 ms-sm6 mb-4">Place and receive calls</h2>
                    </div>
                    {
                        this.state.loggedIn &&
                        <div>
                            <span>Your User Identity: </span>
                            <span className="identity"><b>{this.state.id}</b></span>
                        </div>
                    }
                    {
                        this.state.showCameraNotFoundWarning && 
                        <MessageBar
                            messageBarType={MessageBarType.warning}
                            isMultiline={false}
                            onDismiss={ () => { this.setShowCameraNotFoundWarning(false) }}
                            dismissButtonAriaLabel="Close">
                            <b>No camera device found!</b>
                        </MessageBar>
                    }
                    {
                        this.state.showSpeakerNotFoundWarning && 
                        <MessageBar
                            messageBarType={MessageBarType.warning}
                            isMultiline={false}
                            onDismiss={ () => { this.setShowSpeakerNotFoundWarning(false) }}
                            dismissButtonAriaLabel="Close">
                            <b>No speaker device found!</b>
                        </MessageBar>
                    }
                    {
                        this.state.showMicrophoneNotFoundWarning && 
                        <MessageBar
                            messageBarType={MessageBarType.warning}
                            isMultiline={false}
                            onDismiss={ () => { this.setShowMicrophoneNotFoundWarning(false) }}
                            dismissButtonAriaLabel="Close">
                            <b>No microphone device found!</b>
                        </MessageBar>
                    }
                    {
                        !this.state.loggedIn &&
                        <div className="custom-row justify-content-center align-items-center mt-4">
                            <div className="loader"> </div>
                            <div className="ml-2">Initializing SDK...</div>
                        </div>
                    }
                    {
                        !this.state.call && this.state.loggedIn &&
                        <div className="ms-Grid-row mt-3">
                            <div className="mb-5 ms-Grid-col ms-sm12 ms-md12 ms-lg4 ms-lgPush4">
                                <h3 className="mb-1">Place a call</h3>
                                <div>Enter a User Identity to make a call to.</div>
                                <div>You can specify multiple Identities to call by using "," separated values.</div>
                                <TextField disabled={this.state.call || !this.state.loggedIn}
                                            label="Destination User Identity"
                                            componentRef={(val) => this.destinationUserIds = val} />
                                <PrimaryButton className="primary-button mt-3" iconProps={{iconName: 'Phone', style: {verticalAlign: 'middle', fontSize: 'large'}}} text="Place call" disabled={this.state.call || !this.state.loggedIn} label="Place call" onClick={this.placeCall}></PrimaryButton>
                            </div>
                        </div>
                    }
                    {
                        this.state.call && this.state.loggedIn && 
                            <div>
                                <CallCard call={this.state.call} dir={this.state.dir} 
                                        deviceManager={this.deviceManager}
                                        onShowCameraNotFoundWarning={() => {this.setShowCameraNotFoundWarning}}
                                        onShowSpeakerNotFoundWarning={() => {this.setShowSpeakerNotFoundWarning}}
                                        onShowMicrophoneNotFoundWarning={() => {this.setShowMicrophoneNotFoundWarning}}/>
                            
                            </div>
                    }
                    
                </div>
            </div>
        );
    }
}