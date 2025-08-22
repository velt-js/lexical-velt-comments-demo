import { initVelt } from "@veltdev/client";
import type { CommentAnnotation, Velt } from "@veltdev/types";

export let client: Velt;
export let commentAnnotations: CommentAnnotation[] = [];
export const commentAnnotationSubscriptions: Record<string, (annotations: CommentAnnotation[]) => void> = {};

const initializeVelt = async () => {
    console.log('initializeVelt', window.Velt);
    // Initialize the Velt client with your API key
    client = await initVelt("Emcfab4ysRXaC1CZ8hmG");

    if (client) {
        const commentElement = client.getCommentElement();
        if (commentElement) {
            commentElement.disableTextComments();
        }
    }
}

/**
 * To set the document ID for the Velt client
 */
const setDocumentId = () => {
    if (client) {
        client.setDocument("lexical-velt-comments-demo1-22-aug-25");
    }
}

/**
 * To identify the user for the Velt client
 */
const identifyUser = () => {
    if (client) {
        // Replace the user object with your user data
        const user = {
            userId: "1",
            email: "test@velt.dev",
            name: "Test User",
            color: "#8b4bef",
            organizationId: "testOrg1"
        };
        client.identify(user);
    }
}

export const setupVelt = async () => {
    // Call the initializeVelt function when the component is mounted
    await initializeVelt();
    setDocumentId();
    identifyUser();

    client.getCommentElement().getAllCommentAnnotations().subscribe((annotations: CommentAnnotation[] | null) => {
        commentAnnotations = annotations || [];
        notifyCommentAnnotations(commentAnnotations);
    });
}

export const subscribeToCommentAnnotations = (key: string, callback: (annotations: CommentAnnotation[]) => void) => {
    commentAnnotationSubscriptions[key] = callback;
}

export const unsubscribeFromCommentAnnotations = (key: string) => {
    delete commentAnnotationSubscriptions[key];
}

export const notifyCommentAnnotations = (annotations: CommentAnnotation[]) => {
    Object.values(commentAnnotationSubscriptions).forEach((callback) => {
        callback(annotations ? JSON.parse(JSON.stringify(annotations)) : annotations);
    });
}

setupVelt();