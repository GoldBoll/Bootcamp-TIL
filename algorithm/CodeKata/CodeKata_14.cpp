//https://school.programmers.co.kr/learn/courses/30/lessons/12935

// #include <string>
// #include <vector>
// #include <algorithm>
// using namespace std;

// vector<int> solution(vector<int> arr) {
//     vector<int> answer;
//     if(arr.empty() || arr.size() == 1)
//     {
//         return {-1};
//     }
//     int min = *min_element(arr.begin(), arr.end());
    
//     for(auto& n : arr)
//     {
//         if(n != min) answer.push_back(n);
//     }
    
//     return answer;
// }



#include <string>
#include <vector>
#include <algorithm>
using namespace std;

vector<int> solution(vector<int> arr) {
    vector<int> answer;
    if(arr.empty() || arr.size() == 1)
    {
        return {-1};
    }
    arr.erase(min_element(arr.begin(), arr.end()));
    
    answer = arr;
    
    return answer;
}