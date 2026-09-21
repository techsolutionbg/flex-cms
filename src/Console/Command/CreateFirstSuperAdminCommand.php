<?php

declare(strict_types=1);

namespace Flex\Console\Command;

use Flex\Users\UserRepository;
use Flex\Users\UserService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Helper\QuestionHelper;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\Question;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'user:create-first-super-admin', description: 'Create the first active super administrator user.')]
final class CreateFirstSuperAdminCommand extends Command
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly UserService $userService,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('name', null, InputOption::VALUE_REQUIRED, 'Full name of the first administrator.')
            ->addOption('email', null, InputOption::VALUE_REQUIRED, 'Email address of the first administrator.')
            ->addOption('password', null, InputOption::VALUE_REQUIRED, 'Password of the first administrator. Avoid using this option in shell history.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        if ($this->users->all()->isNotEmpty()) {
            $io->error('The first super administrator cannot be created because users already exist.');

            return self::FAILURE;
        }

        $noInteraction = !$input->isInteractive();
        $name = $this->value($input->getOption('name'));
        $email = $this->value($input->getOption('email'));
        $password = $this->value($input->getOption('password'));

        if (!$noInteraction) {
            $helper = $this->getHelper('question');
            if (!$helper instanceof QuestionHelper) {
                throw new \RuntimeException('The console question helper is unavailable.');
            }
            $name ??= (string) $helper->ask($input, $output, new Question('Full name: '));
            $email ??= (string) $helper->ask($input, $output, new Question('Email: '));
            $password ??= $this->askPassword($helper, $input, $output);
        }

        if ($name === null || $email === null || $password === null) {
            $io->error('Name, email and password are required.');

            return self::FAILURE;
        }

        try {
            $user = $this->userService->create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role' => 'super_admin',
                'status' => 'active',
            ]);
        } catch (\Throwable $exception) {
            $io->error($exception->getMessage());

            return self::FAILURE;
        }

        $io->success('The first super administrator was created.');
        $io->definitionList(
            ['ID' => (string) $user->getAttribute('id')],
            ['Name' => (string) $user->getAttribute('name')],
            ['Email' => (string) $user->getAttribute('email')],
            ['Role' => (string) $user->getAttribute('role')],
            ['Status' => (string) $user->getAttribute('status')],
        );

        return self::SUCCESS;
    }

    private function askPassword(QuestionHelper $helper, InputInterface $input, OutputInterface $output): string
    {
        $question = new Question('Password: ');
        $question->setHidden(true);
        $question->setHiddenFallback(false);

        return (string) $helper->ask($input, $output, $question);
    }

    private function value(mixed $value): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        return $value;
    }
}
