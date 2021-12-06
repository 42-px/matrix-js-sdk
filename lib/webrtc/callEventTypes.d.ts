import { CallErrorCode } from "./call";
export declare const SDPStreamMetadataKey = "org.matrix.msc3077.sdp_stream_metadata";
export declare enum SDPStreamMetadataPurpose {
    Usermedia = "m.usermedia",
    Screenshare = "m.screenshare"
}
export interface SDPStreamMetadataObject {
    purpose: SDPStreamMetadataPurpose;
    audio_muted: boolean;
    video_muted: boolean;
}
export interface SDPStreamMetadata {
    [key: string]: SDPStreamMetadataObject;
}
export interface CallCapabilities {
    'm.call.transferee': boolean;
    'm.call.dtmf': boolean;
}
export interface CallReplacesTarget {
    id: string;
    display_name: string;
    avatar_url: string;
}
export interface MCallBase {
    call_id: string;
    version: string | number;
    party_id?: string;
}
export interface MCallAnswer extends MCallBase {
    answer: RTCSessionDescription;
    capabilities?: CallCapabilities;
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}
export interface MCallSelectAnswer extends MCallBase {
    selected_party_id: string;
}
export interface MCallInviteNegotiate extends MCallBase {
    offer: RTCSessionDescription;
    description: RTCSessionDescription;
    lifetime: number;
    capabilities?: CallCapabilities;
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}
export interface MCallSDPStreamMetadataChanged extends MCallBase {
    [SDPStreamMetadataKey]: SDPStreamMetadata;
}
export interface MCallReplacesEvent extends MCallBase {
    replacement_id: string;
    target_user: CallReplacesTarget;
    create_call: string;
    await_call: string;
    target_room: string;
}
export interface MCAllAssertedIdentity extends MCallBase {
    asserted_identity: {
        id: string;
        display_name: string;
        avatar_url: string;
    };
}
export interface MCallCandidates extends MCallBase {
    candidates: RTCIceCandidate[];
}
export interface MCallHangupReject extends MCallBase {
    reason?: CallErrorCode;
}
//# sourceMappingURL=callEventTypes.d.ts.map