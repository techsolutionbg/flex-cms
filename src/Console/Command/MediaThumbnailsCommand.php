<?php

declare(strict_types=1);
namespace Flex\Console\Command;

use Flex\Media\MediaService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\{InputInterface, InputOption};
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'media:thumbnails', description: 'Generate optimized media previews in resumable batches.')]
final class MediaThumbnailsCommand extends Command
{
    public function __construct(private readonly MediaService $media) { parent::__construct(); }
    protected function configure(): void
    {
        $this->addOption('force', null, InputOption::VALUE_NONE, 'Regenerate existing optimized previews.')
            ->addOption('after-id', null, InputOption::VALUE_REQUIRED, 'Resume after this media ID.', '0')
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Maximum images per batch (1–1000).', '100');
    }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $after = filter_var($input->getOption('after-id'), FILTER_VALIDATE_INT);
        $limit = filter_var($input->getOption('limit'), FILTER_VALIDATE_INT);
        if ($after === false || $after < 0 || $limit === false || $limit < 1 || $limit > 1000) {
            $output->writeln('Invalid after-id or limit.');
            return self::INVALID;
        }
        $counts = ['generated' => 0, 'skipped' => 0, 'failed' => 0];
        foreach ($this->media->regenerateThumbnails((bool) $input->getOption('force'), $after, $limit) as $result) {
            $counts[$result['status']]++;
            $after = $result['id'];
            $output->writeln(sprintf('%d: %s — %s', $after, $result['status'], $result['message']), OutputInterface::OUTPUT_RAW);
        }
        $output->writeln(sprintf('Generated: %d; skipped: %d; failed: %d. Resume with --after-id=%d', $counts['generated'], $counts['skipped'], $counts['failed'], $after));
        return $counts['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
