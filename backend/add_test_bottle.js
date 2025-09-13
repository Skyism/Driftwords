import { respond_fish } from './respond_fish.js'

const addTestBottle = async () => {
    console.log('Adding test bottle...');
    const result = await respond_fish(1, 'test_user', 'This is a test reflection about a small moment that made me smile today.');
    console.log('Result:', result);
}

addTestBottle();
