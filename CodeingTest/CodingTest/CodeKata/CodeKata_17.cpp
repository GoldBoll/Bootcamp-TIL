//https://school.programmers.co.kr/learn/courses/30/lessons/77884

using namespace std;

int solution(int left, int right) {
    int answer = 0;
    
    for(int i = left; i <= right; ++i) {
        int count = 1;
        for(int j = 2; j <= i; ++j) {
            if(i % j == 0) count++;
        }
        if(count % 2 == 0) answer += i;
        else answer -= i;
    }
    return answer;
}