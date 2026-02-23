/**
 * Tipo do conteudo das mensagens
 */


export type TextTypeTemplate = {
    type: "text";
    text: string;
};

export interface TextWithParamsTypeTemplate extends TextTypeTemplate {
    params?: string[];
}

export type MediaTypeTemplate = {
    type: "image" | "video" | "document";
    file: {
        url: string;
        extension: string;
        uploadHash?: string;
        filename?: string;
    };
};

export type ButtonReplyTemplate = {
    type: "reply";
    text: string;
};

export type ButtonCallTemplate = {
    type: "call";
    text: string;
    phoneNumber: string;
};
export type ButtonUrlTemplate = {
    type: "url";
    text: string;
    url: string;
    params?: string[];
};
export type TemplateCodeType = "MARKETING" | "UTILITY";

export interface TemplateMessageContent {
    type: "template";
    id: string;
    name: string;
    category: {
        code: TemplateCodeType;
        name: string;
    };
    acceptedResponsabilitiesByUserId?: number | undefined;
    createdByUserId?: number | undefined;
    status?: { code: string; description: string };
    createdAt?: string;
    updatedAt?: string;
    languageCode: string;
    header?: MediaTypeTemplate | TextWithParamsTypeTemplate;
    body: TextWithParamsTypeTemplate;
    footer?: TextTypeTemplate;
    buttons?: (ButtonReplyTemplate | ButtonCallTemplate | ButtonUrlTemplate)[];
}

/**
 * Tipo do conteudo das mensagens
 */

export interface MessageAttachmentContent {
    caption: string;
    file: {
        url: string;
        filename?: string;
        extension: string;
    };
}

export interface MessageAudioContent extends MessageAttachmentContent {
    type: "audio";
    transcription: string;
}

export interface MessageVideoContent extends MessageAttachmentContent {
    type: "video";
}

export interface MessageImageContent extends MessageAttachmentContent {
    type: "image";
}
export interface MessageDocumentContent extends MessageAttachmentContent {
    type: "document";
}

export interface MessageLinkContent {
    type: "link";
    title: string;
    message: string;
    link: string;
    description: string;
    icon: string;
}

export interface ReplyButton {
    type: "reply";
    text: string;
    id: string;
}

export interface LinkButton {
    type: "link";
    text: string;
    url: string;
    id: string;
}

export interface MessageButtonContent {
    type: "button";
    header: string | Omit<MessageImageContent, "caption">;
    body: string;
    footer: string;
    buttons: string[] | (ReplyButton | LinkButton)[];
}
export interface MessageProductContent {
    type: "product";
    title: string;
    price: number;
    currency: string;
    icon: string;
    message: string;
}

export interface MessageLocationContent {
    type: "location";
    latitude: string;
    longitude: string;
    address: string;
}

export interface MessageTextContent {
    type: "text";
    message: string;
    buttonResponseId?: string;
}

export interface MessageContactContent {
    type: "contact";
    name: string;
    phones: Array<
        | { phone: string; is_whatsapp: false }
        | { phone: string; whatsapp: string; is_whatsapp: true }
    >;
    is_created: boolean;
    emails: string[];
    address: {
        extend: string;
        street: string;
        zip: string;
    }[];
}

export interface MessageEmailContent {
    type: "email";
    subject: string;
    text: string; // suporte ao html
    cc: { email: string; name: string }[];
    cco: { email: string; name: string }[];
    replyTo: { email: string; name: string }[];
    to: { email: string; name: string }[];
    from: { email: string; name: string }[];
    files: {
        url: string;
        extension: string;
        filename: string;
    }[];
}

export interface MessageContactsContent {
    type: "contacts";
    contacts: Omit<MessageContactContent, "type">[];
}
export interface IMessageContentMultipleFiles {
    type: "multiple-files";
    caption: string;
    files?: {
        file: { url: string; extension: string };
        type: "audio" | "video" | "image" | "document";
    }[];
}
export type MessageContentType =
    | MessageButtonContent
    | MessageAudioContent
    | MessageDocumentContent
    | MessageLinkContent
    | MessageImageContent
    | MessageLocationContent
    | MessageEmailContent
    | MessageTextContent
    | MessageVideoContent
    | MessageContactContent
    | MessageContactsContent
    | TemplateMessageContent
    | MessageProductContent
    | IMessageContentMultipleFiles;

export type MessageSenderType = "USER" | "CUSTOMER";

export enum ReactionTypeEnum {
    CUSTOMER = "CUSTOMER",
    USER = "USER",
}

export type MessageContentTypeEnum = Omit<MessageContentType, "type">;
export type MessageReplyType = {
    id?: string;
    content: MessageContentType;
    sender_name?: string;
};

export interface MentionType {
    id: string;
    data: { id: number; name: string };
    isCreated: boolean;
    isClickable: boolean;
}

export enum MessageStatus {
    SUCCESS = "SUCCESS",
    ERROR = "ERROR",
    LOADING = "LOADING",
}

export interface MessageQueueData{
    instanceId: string;
    customerId: string;
    message: MessageContentType;
}