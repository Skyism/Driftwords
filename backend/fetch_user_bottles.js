import supabase from './supabase.js'

const fetch_user_bottles = async (username) => {
    const { data, error } = await supabase
        .from('bottles')
        .select('*')
        .eq('username', username)

    if (error) {
        console.error('Select error:', error)
        return null
    }

    return data
}

export { fetch_user_bottles }