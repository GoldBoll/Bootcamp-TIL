//https://school.programmers.co.kr/learn/courses/30/lessons/120817

#include <string>
#include <vector>
#include <numeric>

using namespace std;

double solution(vector<int> numbers) {
    int sum = accumulate(numbers.begin(), numbers.end(), 0);   // 최대 100 * 1000 = 100,000 — int로 충분
    return static_cast<double>(sum) / numbers.size();          // size()가 size_t라 캐스팅 없으면 정수 나눗셈
}
