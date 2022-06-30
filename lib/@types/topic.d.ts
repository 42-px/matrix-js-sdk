import { EitherAnd, IMessageRendering } from "matrix-events-sdk";
import { UnstableValue } from "../NamespacedValue";
/**
 * Extensible topic event type based on MSC3765
 * https://github.com/matrix-org/matrix-spec-proposals/pull/3765
 */
/**
 * Eg
 * {
 *      "type": "m.room.topic,
 *      "state_key": "",
 *      "content": {
 *          "topic": "All about **pizza**",
 *          "m.topic": [{
 *              "body": "All about **pizza**",
 *              "mimetype": "text/plain",
 *          }, {
 *              "body": "All about <b>pizza</b>",
 *              "mimetype": "text/html",
 *          }],
 *      }
 * }
 */
/**
 * The event type for an m.topic event (in content)
 */
export declare const M_TOPIC: UnstableValue<"m.topic", "org.matrix.msc3765.topic">;
/**
 * The event content for an m.topic event (in content)
 */
export declare type MTopicContent = IMessageRendering[];
/**
 * The event definition for an m.topic event (in content)
 */
export declare type MTopicEvent = EitherAnd<{
    [M_TOPIC.name]: MTopicContent;
}, {
    [M_TOPIC.altName]: MTopicContent;
}>;
/**
 * The event content for an m.room.topic event
 */
export declare type MRoomTopicEventContent = {
    topic: string;
} & MTopicEvent;
//# sourceMappingURL=topic.d.ts.map