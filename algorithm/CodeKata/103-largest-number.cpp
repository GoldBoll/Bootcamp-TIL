// 프로그래머스 42746 - 가장 큰 수 (Lv.5)
// https://school.programmers.co.kr/learn/courses/30/lessons/42746

// 문제 설명
// 0 또는 양의 정수가 담긴 배열 numbers가 주어진다.
// 이 수들을 이어 붙여 만들 수 있는 가장 큰 수를 문자열로 반환하라.
// [6, 10, 2]라면 6210, 62103, 6102, ... 중 가장 큰 "6210".

// 제약 조건
// 1 <= numbers 길이 <= 100,000
// 0 <= numbers 원소 <= 1,000
// 정답이 매우 클 수 있으므로 문자열로 반환한다.

// Example
// Input : [6, 10, 2]            Output: "6210"
// Input : [3, 30, 34, 5, 9]     Output: "9534330"

// 접근 — 두 수의 순서만 정하는 비교자 a+b > b+a로 정렬
// 순열을 다 만들면 100,000!. 대신 "인접한 두 수의 앞뒤만 최적이면 전체가 최적"이라는
// 국소 교환 논증을 쓴다. a를 앞에 둘지 b를 앞에 둘지는 이어 붙인 문자열
// a+b와 b+a를 사전순 비교한 결과와 같다(길이가 같으므로 사전순 = 수의 크기 비교).
// 1) 각 수를 문자열로 바꾼다. 자릿수가 다른 수를 그냥 사전순 정렬하면
//    "3" < "30"이 되어 3을 뒤로 보내는데, 실제로는 "330" > "303"이라 3이 앞이어야 한다.
//    이어 붙인 결과로 비교해야 자릿수 차이가 자동으로 흡수된다.
// 2) sort(v, cmp)로 내림차순 배치 후 전부 이어 붙인다.
// 3) 전부 0이면 "000...0"이 되므로 첫 글자가 '0'일 때 "0"으로 정규화한다.
//    내림차순이므로 첫 글자가 '0'이면 나머지도 모두 0이다.
// 시간 O(n log n * L) (L = 최대 자릿수 4), 공간 O(n * L)

#include <string>
#include <vector>
#include <algorithm>

using namespace std;

bool cmp(const string& a, const string& b)
{
    return a + b > b + a;                          // >= 로 쓰면 strict weak ordering 위반
}

string solution(vector<int> numbers)
{
    vector<string> v;
    v.reserve(numbers.size());

    for (int n : numbers)
        v.push_back(to_string(n));                 // 비교 단위를 수에서 문자열로 바꿈

    sort(v.begin(), v.end(), cmp);

    string answer;
    for (const string& s : v)
        answer += s;

    if (answer[0] == '0')                          // 전부 0인 입력 정규화
        return "0";

    return answer;
}
