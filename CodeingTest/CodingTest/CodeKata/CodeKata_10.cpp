// 코드카타 25. 나누어 떨어지는 숫자 배열 (Lv.1)
// https://school.programmers.co.kr/learn/courses/30/lessons/12910

// 문제 설명
// vector<int> arr에서 int divisor로 나누어 떨어지는 원소만 골라 오름차순 정렬해서 반환.
// 나누어 떨어지는 원소가 없으면 [-1] 반환.

// 제한사항
// arr의 길이: 1 이상 100 이하
// arr의 원소: 100 이하의 자연수
// divisor: 1 이상 10 이하의 자연수

// 입출력 예
// arr            | divisor | return
// [5, 9, 7, 10]  | 5       | [5, 10]
// [2, 36, 1, 3]  | 1       | [1, 2, 3, 36]
// [3, 2, 6]      | 10      | [-1]

#include <string>
#include <vector>
#include <algorithm>
#include <iterator>     // back_inserter
using namespace std;

// 풀이 1 - for 루프 + sort | 시간복잡도: O(n + k log k)
//vector<int> solution(vector<int> arr, int divisor) {
//    vector<int> answer;
//
//    for (size_t i = 0; i < arr.size(); i++)
//    {
//        if(arr[i] % divisor == 0)
//        {
//            answer.push_back(arr[i]);
//        }
//    }
//
//    if(answer.size() == 0)
//    {
//        answer.push_back(-1);
//    }
//    else
//    {
//        sort(answer.begin(), answer.end());
//    }
//
//    return answer;
//}

// 풀이 2 - copy_if + sort (STL 활용) | 시간복잡도: O(n + k log k)
vector<int> solution(vector<int> arr, int divisor) {
    vector<int> answer;

    copy_if(arr.begin(), arr.end(), back_inserter(answer),
            [divisor](int x){ return x % divisor == 0; });

    if(answer.empty())
    {
        answer.push_back(-1);
    }
    else
    {
        sort(answer.begin(), answer.end());
    }

    return answer;
}
