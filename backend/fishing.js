import supabase from './supabase.js'

const fish_for_fish = async (username) => {
    const { data, error } = await supabase
        .from('fish')
        .select('*')
        .or(`fished_by.not.cs.{${username}}, fished_by.is.null`)
        .limit(30)

    if (error) {
        console.error('Select error:', error)
        return null
    }

    if (!data || data.length === 0) {
        console.log('No fish found')
        return null
    }

    // Pick a random fish from the fetched array
    const randomIndex = Math.floor(Math.random() * data.length);
    const fish = data[randomIndex];

    const updatedFishedBy = fish.fished_by 
        ? [...fish.fished_by, username] 
        : [username];

    console.log('Updating fish id:', fish.id, 'with fished_by:', updatedFishedBy);

    const { error: updateError } = await supabase
        .from('fish')
        .update({ fished_by: updatedFishedBy })
        .eq('id', fish.id);

    if (updateError) {
        console.error('Update error:', updateError)
        return fish;
    }

    return fish;
}

const fish_for_bottles = async (username) => {
    console.log('fish_for_bottles called with username:', username);
    
    const { data, error } = await supabase
        .from('bottles')
        .select('*')

    console.log('All bottles query result:', { data, error });

    if (error) {
        console.error('Select error:', error)
        return null
    }

    if (!data || data.length === 0) {
        console.log('No bottles found in database')
        return null
    }

    console.log('Found bottles:', data.length);
    
    // Filter out user's own bottles
    const notMyBottles = data.filter(bottle => bottle.username !== username);
    console.log('Bottles not by user:', notMyBottles.length);

    if (notMyBottles.length === 0) {
        console.log('No bottles from other users')
        return null
    }

    // Filter out bottles already fished by this user
    const availableBottles = notMyBottles.filter(bottle => {
        return !bottle.fished_by || !bottle.fished_by.includes(username);
    });

    console.log('Available bottles after filtering:', availableBottles.length);

    if (availableBottles.length === 0) {
        console.log('No unfished bottles available')
        return null
    }

    const randomIndex = Math.floor(Math.random() * availableBottles.length);
    const bottle = availableBottles[randomIndex];

    console.log('Selected bottle:', bottle);

    const updatedFishedBy = bottle.fished_by 
        ? [...bottle.fished_by, username] 
        : [username];

    console.log('Updating bottle id:', bottle.id, 'with fished_by:', updatedFishedBy);

    const { error: updateError } = await supabase
        .from('bottles')
        .update({ fished_by: updatedFishedBy })
        .eq('id', bottle.id);

    if (updateError) {
        console.error('Update error:', updateError)
        return bottle;
    }

    return bottle;
}



export { fish_for_fish, fish_for_bottles }