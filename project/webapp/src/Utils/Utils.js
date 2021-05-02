import { isCommunicationUserIdentifier, isPhoneNumberIdentifier, isMicrosoftTeamsUserIdentifier } from '@azure/communication-common';

export const utils = {
    getIdentifierText: (identifier) => {
        if (isCommunicationUserIdentifier(identifier)) {
            return identifier.communicationUserId;
        } else if (isPhoneNumberIdentifier(identifier)) {
            return identifier.phoneNumber;
        } else if(isMicrosoftTeamsUserIdentifier(identifier)) {
            return identifier.microsoftTeamsUserId;
        } else {
            return 'Unknwon Identifier';
        }
    }
}
