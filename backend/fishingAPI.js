import { respond_fish, respond_bottle } from './bottle-functions.js';

export const fishingAPI = {
    createBottle: respond_fish,
    respondToBottle: respond_bottle
};