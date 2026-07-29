//https://school.programmers.co.kr/learn/courses/30/lessons/120831

int solution(int n) {
    int half = n / 2;            // n 이하 짝수는 2, 4, ..., 2*half — 개수 = n/2 (내림)
    return half * (half + 1);    // 2*(1+2+...+half) = 2 * half(half+1)/2 = half(half+1)
}
