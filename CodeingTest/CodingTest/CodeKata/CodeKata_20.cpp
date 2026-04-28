//https://school.programmers.co.kr/learn/courses/30/lessons/12940

#include <string>
#include <vector>

using namespace std;

vector<int> solution(int n, int m) {
    vector<int> answer;

    int num1 = n, num2 = m;
    while (num2 != 0)
    {
        int temp = num2;
        num2 = num1 % num2;
        num1 = temp;
    }
    int max = num1;
    int min = n / max * m;

    answer.push_back(max);
    answer.push_back(min);

    return answer;
}
