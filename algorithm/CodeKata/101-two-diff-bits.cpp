//https://school.programmers.co.kr/learn/courses/30/lessons/77885

#include <vector>

using namespace std;

vector<long long> solution(vector<long long> numbers) {
    vector<long long> answer;

    for (long long x : numbers) {
        if (x % 2 == 0) {                   // 짝수는 마지막 0비트만 켜면 끝
            answer.push_back(x + 1);
            continue;
        }

        long long bit = 1;
        while (x & bit) bit <<= 1;          // 오른쪽부터 처음 만나는 0비트 자리
        answer.push_back(x + (bit >> 1));   // 그 자리를 켜고(+bit) 바로 아래를 끈다(-bit/2)
    }
    return answer;
}
