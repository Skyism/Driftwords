// import { fish_for_fish, fish_for_bottles } from './fishing.js'
// import { respond_fish } from './respond_fish.js'
import { respond_fish } from './respond_fish.js'

const test = async () => {
    // const data = await fish_for_fish('test_user2')
    // console.log(data)

    // const data2 = await fish_for_bottles('test_user2')
    // console.log(data2)

    // const data3 = await respond_bottle('test_user2', data2.question_id, 'test_response')
    // console.log(data3)

    const data4 = await respond_fish(27, 'skibidiyakuman', 'I am so skibidi')
    console.log(data4)

    // const data5 = await fetch_user_bottles('test_user')
    // console.log(data5)
}

test()