import supabase from './supabase.js'

const fishing = async () => {
    const { data, error } = await supabase.from('fishing').select('*')
    if (error) {
        console.error(error)
    }
    return data
}

export default fishing