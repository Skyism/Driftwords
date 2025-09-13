import { respond_fish, respond_bottle } from './respond_fish.js';

export const fishingAPI = {
    createBottle: respond_fish,
    respondToBottle: respond_bottle
};