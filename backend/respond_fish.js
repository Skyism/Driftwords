import supabase from './supabase.js'

const respond_bottle = async (username, question_id, response) => {

    const {data, error} = await supabase
        .from('bottles')
        .select('*')
        .eq('question_id', question_id)

    if (error) {
        console.error('Select error:', error)
        return null
    }

    if (!data || data.length === 0) {
        console.log('No bottle found')
        return null
    }

    const response_json = {
        username: username,
        response: response
    }

    const updatedResponses = data.responses 
        ? [...data.responses, response_json] 
        : [response_json];

    const { error: inserterror} = await supabase
        .from('bottles')
        .update({responses: updatedResponses})
        .eq('question_id', question_id)


    if (inserterror) {
        console.error('Insert error:', inserterror)
        return null
    }
    return response_json
}

const respond_fish = async (fish_id, username, message) => {
    const {data: skibidi_data, er} = await supabase
        .from('bottles')
        .select('*')

    if (er) {
        console.error('Sigma error:', error)
        return null
    }

    const ind = skibidi_data.length + 1
    
    const {data: fish_data, error} = await supabase
        .from('fish')
        .select('*')
        .eq('id', fish_id)
        .single()
    
    console.log(fish_data)
    
    if (error) {
        console.error('Skibidi error:', error)
        return null
    }

    if (!fish_data) {
        console.log('No fish found with id:', fish_id)
        return null
    }

    const {error: insertError} = await supabase
        .from('bottles')
        .insert({
            'question': fish_data.question, 
            'question_type': fish_data.question_type, 
            'fished_by': [], 
            'username': username, 
            'message': message, 
            'responses': [], 
            'question_id': fish_id
        })

    if (insertError) {
        console.error('Skibeedee error:', insertError)
        return null
    }

    return 0;
}
export { respond_bottle, respond_fish }
