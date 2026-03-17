#pragma once
#include <iostream>
#include <string>
using namespace std;
class Monster;
class Player {
public:
    Player(string nickname);
    virtual ~Player();
    virtual void attack() = 0;
    virtual void attack(Monster* monster) = 0;
    void printPlayerStatus();
    string getJobName();
    string getNickname();
    int getLevel(); int getHP(); int getMP();
    int getPower(); int getDefence(); int getAccuracy(); int getSpeed();
    void setNickname(string nickname);
    void setHP(int HP); void setMP(int MP);
    void setPower(int power); void setDefence(int defence);
    void setAccuracy(int accuracy); void setSpeed(int speed);
protected:
    string job_name, nickname;
    int level, HP, MP, power, defence, accuracy, speed;
};
