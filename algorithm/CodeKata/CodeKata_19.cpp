//https://school.programmers.co.kr/learn/courses/30/lessons/82612

#include <string>
#include <vector>

using namespace std;

// for문 풀이
long long solution(int price, int money, int count)
{
    long long answer = 0;
    long long total = 0;

    for (int i = 1; i <= count; i++)
    {
        total += (long long)price * i;
    }

    answer = total - money;
    return answer > 0 ? answer : 0;
}

// 등차수열 합 공식 풀이 — O(1)
// long long solution(int price, int money, int count)
// {
//     long long total = (long long)price * count * (count + 1) / 2;
//     long long diff = total - money;
//     return diff > 0 ? diff : 0;
// }
