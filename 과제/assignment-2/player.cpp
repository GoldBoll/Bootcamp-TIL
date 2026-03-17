#include "player.h"
Player::Player(string nickname)
    : nickname(nickname), level(1), HP(100), MP(100),
      power(10), defence(5), accuracy(10), speed(10) {}
Player::~Player() {}
void Player::printPlayerStatus() {
    cout << "------------------------------------" << endl;
    cout << "* 현재 능력치" << endl;
    cout << "닉네임: " << nickname << endl;
    cout << "직업: " << job_name << endl;
    cout << "Lv. " << level << endl;
    cout << "HP: " << HP << endl;
    cout << "MP: " << MP << endl;
    cout << "공격력: " << power << endl;
    cout << "방어력: " << defence << endl;
    cout << "정확도: " << accuracy << endl;
    cout << "속도: " << speed << endl;
    cout << "------------------------------------" << endl;
}
string Player::getJobName()  { return job_name; }
string Player::getNickname() { return nickname; }
int Player::getLevel()    { return level; }
int Player::getHP()       { return HP; }
int Player::getMP()       { return MP; }
int Player::getPower()    { return power; }
int Player::getDefence()  { return defence; }
int Player::getAccuracy() { return accuracy; }
int Player::getSpeed()    { return speed; }
void Player::setNickname(string n) { nickname = n; }
void Player::setHP(int v)       { HP = v; }
void Player::setMP(int v)       { MP = v; }
void Player::setPower(int v)    { power = v; }
void Player::setDefence(int v)  { defence = v; }
void Player::setAccuracy(int v) { accuracy = v; }
void Player::setSpeed(int v)    { speed = v; }
